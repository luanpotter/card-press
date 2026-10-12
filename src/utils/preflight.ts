import { SvgOutput } from "@/types/session";
import { ImageFormat, imageFormatOf, isDecodable, mimeTypeOf } from "@/utils/decodeImage";
import { dataUrlToBytes } from "@/utils/imageFiles";
import { checkSvgOutput, parseSvg } from "@/utils/svgSupport";

/**
 * Checks of what a PDF will print, the same before generating (to flag cards) as during (to refuse them).
 */

/**
 * Check a card image prints with the session's SVG output, throwing why it cannot.
 * Returns the SVG parsed for the check, for outputs that check SVGs, so it is parsed once.
 */
export function checkCardImage(dataUrl: string, svgOutput: SvgOutput): Element | undefined {
  if (!isDecodable(dataUrl)) {
    throw new Error(`${mimeTypeOf(dataUrl)} images are not supported`);
  }
  // The browser renderer draws anything a browser does
  if (imageFormatOf(dataUrl) !== ImageFormat.Svg || svgOutput === SvgOutput.RasterBrowser) {
    return undefined;
  }
  const svg = parseSvg(new TextDecoder().decode(dataUrlToBytes(dataUrl)));
  checkSvgOutput(svg, svgOutput);
  return svg;
}

/** Why a card image cannot print with the session's SVG output, if it cannot */
export function cardImageProblem(dataUrl: string, svgOutput: SvgOutput): string | undefined {
  try {
    checkCardImage(dataUrl, svgOutput);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
