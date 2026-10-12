import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { Dimension } from "@/types/dimension";

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
 * What it can draw is checked beforehand, by checkSvgOutput.
 */
export async function svgToPdf(svg: Element): Promise<Uint8Array> {
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("is not a valid SVG");
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
