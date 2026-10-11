import { mat2d, type ReadonlyMat2d } from "gl-matrix";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";

// Convert PDF points to mm (1 inch = 72 points, 1 inch = 25.4mm)
const POINTS_TO_MM = 25.4 / 72;

/**
 * A raster image as drawn on a page.
 * The same image drawn twice yields two placements sharing one `id`.
 */
export interface ImagePlacement {
  /** Identifies the embedded image: its object reference, so repeated placements of one image match */
  id: string;
  pixelWidth: number;
  pixelHeight: number;
  bitsPerComponent: number | undefined;
  colorSpace: string | undefined;
  filters: string[];
  hasSMask: boolean;
  /** Size on the page; negative scales (mirroring) count as their magnitude */
  placedWidthMm: number;
  placedHeightMm: number;
  ppiX: number;
  ppiY: number;
}

export interface PageReport {
  widthMm: number;
  heightMm: number;
  images: ImagePlacement[];
  /** Pixels across the distinct images drawn on this page, in megapixels */
  rasterMegapixels: number;
  /** Everything on this page that forces a print pipeline to flatten transparency */
  transparency: string[];
}

export interface PdfReport {
  pages: PageReport[];
}

// Matrices are [a b c d e f], as used by the PDF `cm` operator, which is also gl-matrix's mat2d layout.
// Plain arrays rather than mat2d.create(), which gives a Float32Array and loses precision.
const IDENTITY: ReadonlyMat2d = [1, 0, 0, 1, 0, 0];

/**
 * Apply `transform` within the space of `matrix`, as `cm` does to the current transformation matrix.
 * The PDF spec writes this `transform × matrix`; gl-matrix composes in the opposite order.
 */
function concat(transform: ReadonlyMat2d, matrix: ReadonlyMat2d): mat2d {
  return mat2d.multiply([0, 0, 0, 0, 0, 0], matrix, transform);
}

type Operand = number | string | null;

interface Operation {
  operator: string;
  operands: Operand[];
}

const WHITESPACE = new Set([" ", "\t", "\r", "\n", "\f", "\0"]);
const DELIMITERS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);

function isRegular(char: string | undefined): char is string {
  return char !== undefined && !WHITESPACE.has(char) && !DELIMITERS.has(char);
}

/**
 * Split a content stream into operators with their operands.
 * Only numbers and names are kept as operands, which is all the inspected operators take;
 * strings, arrays and dictionaries become `null` placeholders.
 */
function parseContentStream(bytes: Uint8Array): Operation[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const operations: Operation[] = [];
  let operands: Operand[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (char === undefined) break;

    if (WHITESPACE.has(char)) {
      i++;
    } else if (char === "%") {
      while (i < text.length && text[i] !== "\n" && text[i] !== "\r") i++;
    } else if (char === "/") {
      let end = i + 1;
      while (isRegular(text[end])) end++;
      operands.push(text.slice(i + 1, end));
      i = end;
    } else if (char === "(") {
      // Literal string: parentheses nest unless escaped
      let depth = 0;
      for (; i < text.length; i++) {
        const c = text[i];
        if (c === "\\") i++;
        else if (c === "(") depth++;
        else if (c === ")" && --depth === 0) break;
      }
      i++;
      operands.push(null);
    } else if (char === "<" && text[i + 1] !== "<") {
      // Hex string
      i = text.indexOf(">", i) + 1 || text.length;
      operands.push(null);
    } else if (char === "<" || char === ">") {
      // Dictionary delimiters << >>
      i += 2;
      operands.push(null);
    } else if (DELIMITERS.has(char)) {
      // Array or procedure delimiters
      i++;
      operands.push(null);
    } else {
      let end = i + 1;
      while (isRegular(text[end])) end++;
      const token = text.slice(i, end);
      i = end;

      const number = Number(token);
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(token) && Number.isFinite(number)) {
        operands.push(number);
      } else if (token === "true" || token === "false" || token === "null") {
        operands.push(null);
      } else if (token === "ID") {
        // Inline image data (after BI and its parameters) is binary: skip to the EI that ends it
        const match = /\sEI(?=\s|$)/.exec(text.slice(i + 1));
        i = match ? i + 1 + match.index + match[0].length : text.length;
        operands = [];
      } else {
        operations.push({ operator: token, operands });
        operands = [];
      }
    }
  }

  return operations;
}

function streamContents(doc: PDFDocument, object: PDFObject | undefined): Uint8Array[] {
  const resolved = object ? doc.context.lookup(object) : undefined;
  if (resolved instanceof PDFRawStream) {
    return [decodePDFRawStream(resolved).decode()];
  }
  if (resolved instanceof PDFArray) {
    return resolved.asArray().flatMap((entry) => streamContents(doc, entry));
  }
  return [];
}

function names(object: PDFObject | undefined): string[] {
  if (object instanceof PDFName) return [object.decodeText()];
  if (object instanceof PDFArray) return object.asArray().flatMap((entry) => names(entry));
  return [];
}

function numberOf(dict: PDFDict, key: string): number | undefined {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

function isTransparencyGroup(dict: PDFDict): boolean {
  const group = dict.lookup(PDFName.of("Group"));
  return group instanceof PDFDict && names(group.get(PDFName.of("S"))).includes("Transparency");
}

/**
 * Why a graphics state introduces transparency, if it does
 */
function extGStateTransparency(state: PDFDict): string[] {
  const reasons: string[] = [];
  for (const key of ["CA", "ca"]) {
    const alpha = numberOf(state, key);
    if (alpha !== undefined && alpha < 1) {
      reasons.push(`ExtGState /${key} ${String(alpha)}`);
    }
  }
  const softMask = state.lookup(PDFName.of("SMask"));
  if (softMask && !(softMask instanceof PDFName && softMask.decodeText() === "None")) {
    reasons.push("ExtGState soft mask");
  }
  const blendModes = names(state.get(PDFName.of("BM")));
  if (blendModes.length > 0 && !blendModes.some((mode) => mode === "Normal" || mode === "Compatible")) {
    reasons.push(`ExtGState blend mode ${blendModes.join(",")}`);
  }
  return reasons;
}

/**
 * Walk a content stream, following form XObjects, recording images and transparency
 */
function walkContent(
  doc: PDFDocument,
  contents: Uint8Array[],
  resources: PDFDict | undefined,
  initialMatrix: ReadonlyMat2d,
  page: PageReport,
  depth: number
): void {
  if (depth > 16) {
    page.transparency.push("form XObjects nested too deep to inspect");
    return;
  }

  const xObjects = resources?.lookup(PDFName.of("XObject"));
  const extGStates = resources?.lookup(PDFName.of("ExtGState"));
  const stack: ReadonlyMat2d[] = [];
  let matrix = initialMatrix;

  for (const { operator, operands } of contents.flatMap(parseContentStream)) {
    if (operator === "q") {
      stack.push(matrix);
    } else if (operator === "Q") {
      matrix = stack.pop() ?? initialMatrix;
    } else if (operator === "cm") {
      if (operands.length === 6 && operands.every((operand) => typeof operand === "number")) {
        matrix = concat(operands, matrix);
      }
    } else if (operator === "gs") {
      const name = operands[0];
      const state =
        typeof name === "string" && extGStates instanceof PDFDict ? extGStates.lookup(PDFName.of(name)) : undefined;
      if (state instanceof PDFDict) {
        page.transparency.push(...extGStateTransparency(state));
      }
    } else if (operator === "Do") {
      const name = operands[0];
      if (typeof name !== "string" || !(xObjects instanceof PDFDict)) continue;

      const entry = xObjects.get(PDFName.of(name));
      const xObject = entry ? doc.context.lookup(entry) : undefined;
      if (!(xObject instanceof PDFRawStream)) continue;

      const subtype = names(xObject.dict.get(PDFName.of("Subtype")))[0];
      if (subtype === "Image") {
        page.images.push(imagePlacement(entry instanceof PDFRef ? entry.toString() : name, xObject.dict, matrix));
      } else if (subtype === "Form") {
        if (isTransparencyGroup(xObject.dict)) {
          page.transparency.push(`form ${name} is a transparency group`);
        }
        const formMatrix = xObject.dict.lookup(PDFName.of("Matrix"));
        const values =
          formMatrix instanceof PDFArray
            ? formMatrix.asArray().map((n) => (n instanceof PDFNumber ? n.asNumber() : 0))
            : [];
        const ownMatrix = values.length === 6 ? values : IDENTITY;
        const ownResources = xObject.dict.lookup(PDFName.of("Resources"));
        walkContent(
          doc,
          [decodePDFRawStream(xObject).decode()],
          ownResources instanceof PDFDict ? ownResources : resources,
          concat(ownMatrix, matrix),
          page,
          depth + 1
        );
      }
    } else if (operator === "BI") {
      page.transparency.push("inline image (not inspected)");
    }
  }
}

function imagePlacement(id: string, dict: PDFDict, matrix: ReadonlyMat2d): ImagePlacement {
  const [a = 0, b = 0, c = 0, d = 0] = matrix;
  // The image fills the unit square, so the matrix maps its edges to these lengths in points
  const widthPts = Math.hypot(a, b);
  const heightPts = Math.hypot(c, d);
  const pixelWidth = numberOf(dict, "Width") ?? 0;
  const pixelHeight = numberOf(dict, "Height") ?? 0;

  return {
    id,
    pixelWidth,
    pixelHeight,
    bitsPerComponent: numberOf(dict, "BitsPerComponent"),
    colorSpace: names(dict.lookup(PDFName.of("ColorSpace")))[0],
    filters: names(dict.lookup(PDFName.of("Filter"))),
    hasSMask: dict.get(PDFName.of("SMask")) !== undefined,
    placedWidthMm: widthPts * POINTS_TO_MM,
    placedHeightMm: heightPts * POINTS_TO_MM,
    ppiX: widthPts > 0 ? (pixelWidth * 72) / widthPts : 0,
    ppiY: heightPts > 0 ? (pixelHeight * 72) / heightPts : 0,
  };
}

/**
 * Report what a print pipeline will meet in a PDF: page sizes, raster images with their
 * placed resolution, and anything requiring transparency flattening.
 *
 * This is the in-app equivalent of `pdfinfo` and `pdfimages -list`.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfReport> {
  const doc = await PDFDocument.load(bytes);

  const pages = doc.getPages().map((pdfPage) => {
    const { width, height } = pdfPage.getMediaBox();
    const page: PageReport = {
      widthMm: width * POINTS_TO_MM,
      heightMm: height * POINTS_TO_MM,
      images: [],
      rasterMegapixels: 0,
      transparency: [],
    };

    if (isTransparencyGroup(pdfPage.node)) {
      page.transparency.push("page is a transparency group");
    }
    walkContent(
      doc,
      streamContents(doc, pdfPage.node.get(PDFName.of("Contents"))),
      pdfPage.node.Resources(),
      IDENTITY,
      page,
      0
    );

    const distinct = new Map(page.images.map((image) => [image.id, image]));
    for (const image of distinct.values()) {
      if (image.hasSMask) {
        page.transparency.push(`image ${image.id} has an SMask`);
      }
      page.rasterMegapixels += (image.pixelWidth * image.pixelHeight) / 1e6;
    }
    page.transparency = [...new Set(page.transparency)];

    return page;
  });

  return { pages };
}
