import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { Dimension } from "@/types/dimension";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * SVG elements svg2pdf.js draws; it skips any other without a word.
 * It doesn't export these: they are the cases of `parse` in its source (v2.8.1), to check when upgrading.
 */
const CONVERTED_ELEMENTS = new Set([
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
  "text",
  "tspan",
  "use",
]);

/** SVG elements that draw nothing themselves, so skipping them loses nothing */
const INERT_ELEMENTS = new Set(["defs", "desc", "metadata", "stop", "style", "title"]);

/**
 * The SVG elements that svg2pdf.js would leave out of the PDF, like masks and filters.
 * Elements of other namespaces, like an editor's metadata, are not drawn by any renderer.
 */
function unsupportedElements(svg: Element): string[] {
  const names = Array.from(svg.getElementsByTagNameNS(SVG_NAMESPACE, "*"), (element) => element.localName);
  return [...new Set(names)].filter((name) => {
    const lower = name.toLowerCase();
    return !CONVERTED_ELEMENTS.has(lower) && !INERT_ELEMENTS.has(lower);
  });
}

/** The size of an SVG in an image element: its width and height, else its viewBox */
function svgSize(svg: SVGSVGElement): Dimension {
  const absolute = (length: SVGAnimatedLength, attribute: string) =>
    svg.hasAttribute(attribute) && length.baseVal.unitType !== SVGLength.SVG_LENGTHTYPE_PERCENTAGE;

  if (absolute(svg.width, "width") && absolute(svg.height, "height")) {
    return { width: svg.width.baseVal.value, height: svg.height.baseVal.value };
  }
  const { width, height } = svg.viewBox.baseVal;
  return { width, height };
}

/**
 * Convert an SVG to a one page PDF of vector graphics, the page being the SVG's own size.
 * Throws for an SVG that the conversion would not draw in full, rather than print it wrong.
 */
export async function svgToPdf(svgText: string): Promise<Uint8Array> {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = document.documentElement;
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("is not a valid SVG");
  }

  const unsupported = unsupportedElements(svg);
  if (unsupported.length > 0) {
    throw new Error(`uses ${unsupported.join(", ")}, which vector output cannot draw: use a raster SVG output`);
  }

  const { width, height } = svgSize(svg);
  if (!(width > 0 && height > 0)) {
    throw new Error("has no size: give it a width and height, or a viewBox");
  }

  const pdf = new jsPDF({
    unit: "pt",
    format: [width, height],
    orientation: width > height ? "landscape" : "portrait",
  });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width, height });
  return new Uint8Array(pdf.output("arraybuffer"));
}
