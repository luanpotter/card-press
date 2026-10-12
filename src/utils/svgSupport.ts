import { SvgOutput } from "@/types/session";

/**
 * What each SVG output can draw, checked before rendering so that no card prints with parts silently missing.
 */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * SVG elements svg2pdf.js draws; it skips any other without a word.
 * It doesn't export these: they are the cases of `parse` in its source (v2.8.1), to check when upgrading.
 * It draws text too, but in a stand-in font, so text is checked apart.
 */
const VECTOR_ELEMENTS = new Set([
  "a",
  "circle",
  "clippath",
  "ellipse",
  "g",
  "image",
  "line",
  "lineargradient",
  "marker",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "svg",
  "symbol",
  "use",
]);

/** SVG elements that draw nothing themselves, so skipping them loses nothing */
const INERT_ELEMENTS = new Set(["defs", "desc", "metadata", "stop", "style", "title"]);

/** SVG elements drawn with fonts */
const TEXT_ELEMENTS = new Set(["text", "tspan", "textpath"]);

/**
 * Parse an SVG, throwing if it is not one
 */
export function parseSvg(svgText: string): Element {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = document.documentElement;
  if (
    svg.namespaceURI !== SVG_NAMESPACE ||
    svg.localName !== "svg" ||
    document.getElementsByTagName("parsererror").length > 0
  ) {
    throw new Error("is not a valid SVG");
  }
  return svg;
}

/**
 * Names of the SVG elements that draw something, as written.
 * Text elements count only with text in them, as editors leave empty ones behind.
 * Elements of other namespaces, like an editor's metadata, are not drawn by any renderer.
 */
function drawnElements(svg: Element): Set<string> {
  const names = new Set<string>();
  for (const element of Array.from(svg.getElementsByTagNameNS(SVG_NAMESPACE, "*"))) {
    const name = element.localName.toLowerCase();
    if (!INERT_ELEMENTS.has(name) && !(TEXT_ELEMENTS.has(name) && !element.textContent.trim())) {
      names.add(element.localName);
    }
  }
  return names;
}

/** Why an output cannot print text, which only the browser draws with its fonts */
const NO_FONTS: Partial<Record<SvgOutput, string>> = {
  [SvgOutput.RasterResvg]: "Raster (resvg) has no fonts",
  [SvgOutput.Vector]: "Vector cannot embed its fonts",
};

/**
 * Throw why an SVG output would not draw an SVG in full, rather than print it wrong.
 * The browser renderer draws anything a browser does.
 */
export function checkSvgOutput(svg: Element, output: SvgOutput): void {
  const drawn = [...drawnElements(svg)];

  const noFonts = NO_FONTS[output];
  if (noFonts && drawn.some((name) => TEXT_ELEMENTS.has(name.toLowerCase()))) {
    throw new Error(
      `it has text, and ${noFonts}: convert its text to curves (outlines) in the SVG, ` +
        `or use the Raster (browser) SVG output`
    );
  }

  if (output === SvgOutput.Vector) {
    const unsupported = drawn.filter((name) => !VECTOR_ELEMENTS.has(name.toLowerCase()));
    if (unsupported.length > 0) {
      throw new Error(`uses ${unsupported.join(", ")}, which vector output cannot draw: use a raster SVG output`);
    }
  }
}
