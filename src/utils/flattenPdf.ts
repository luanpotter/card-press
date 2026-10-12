import {
  PDFArray,
  PDFDict,
  type PDFDocument,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from "pdf-lib";
import { deflate, inflate } from "@/utils/deflate";

/**
 * Flattening of the transparency in base PDFs, like the soft-masked image of Cricut's print-then-cut templates.
 * Printers flatten transparency themselves, badly, so it is done here, onto white paper.
 *
 * Only images drawn onto the blank page are flattened right, as anything they cover is not looked at:
 * that holds for templates, whose image is the page's backdrop.
 * Images in a form it cannot decode exactly (other filters, predictors, CMYK) are left as they are.
 */

const name = (value: string) => PDFName.of(value);

/** Look up an entry, following a reference */
function entry(dict: PDFDict, key: string): PDFObject | undefined {
  return dict.lookup(name(key));
}

function numberEntry(dict: PDFDict, key: string): number | undefined {
  const value = entry(dict, key);
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

/** Color components of a color space whose white is all channels at their maximum, if it is one */
function whiteMaxComponents(colorSpace: PDFObject | undefined): number | undefined {
  if (colorSpace === name("DeviceRGB")) return 3;
  if (colorSpace === name("DeviceGray")) return 1;
  // An ICC profile's own channels: RGB and gray ones, as CMYK white is all channels at zero
  if (colorSpace instanceof PDFArray && colorSpace.lookup(0) === name("ICCBased")) {
    const profile = colorSpace.lookup(1);
    const components = profile instanceof PDFStream ? numberEntry(profile.dict, "N") : undefined;
    return components === 1 || components === 3 ? components : undefined;
  }
  return undefined;
}

/** Whether a Decode array leaves samples as they are: absent, or [0 1] for every component, as pdf-lib writes */
function isIdentityDecode(decode: PDFObject | undefined): boolean {
  if (decode === undefined) return true;
  if (!(decode instanceof PDFArray)) return false;
  return decode.asArray().every((value, index) => value instanceof PDFNumber && value.asNumber() === index % 2);
}

/** The decoded samples of an 8-bit image stream compressed only with plain Flate (or not at all), if it is one */
async function plainSamples(stream: PDFObject | undefined, length: number): Promise<Uint8Array | undefined> {
  if (!(stream instanceof PDFRawStream)) return undefined;
  const { dict } = stream;
  const filter = entry(dict, "Filter");
  const plain =
    (filter === undefined || filter === name("FlateDecode")) &&
    numberEntry(dict, "BitsPerComponent") === 8 &&
    entry(dict, "DecodeParms") === undefined &&
    isIdentityDecode(entry(dict, "Decode"));
  if (!plain) return undefined;
  // Natively, as pdf-lib's own decoder takes about a tenth of a second for a page-sized image
  const samples = filter ? await inflate(stream.contents) : stream.contents;
  return samples.length === length ? samples : undefined;
}

/**
 * Composite a soft-masked image onto white, replacing it in place with an opaque one; returns whether it could
 */
async function flattenImage(doc: PDFDocument, ref: PDFRef, image: PDFRawStream): Promise<boolean> {
  const mask = entry(image.dict, "SMask");
  const width = numberEntry(image.dict, "Width") ?? 0;
  const height = numberEntry(image.dict, "Height") ?? 0;
  const components = whiteMaxComponents(entry(image.dict, "ColorSpace"));
  if (!(mask instanceof PDFRawStream) || !components) return false;
  // A matte means premultiplied colors, which this does not undo
  const sameSize = numberEntry(mask.dict, "Width") === width && numberEntry(mask.dict, "Height") === height;
  if (!sameSize || entry(mask.dict, "Matte") !== undefined) return false;

  const colors = await plainSamples(image, width * height * components);
  const alphas = await plainSamples(mask, width * height);
  if (!colors || !alphas) return false;

  // Opaque pixels kept and clear ones white without arithmetic, as masks are mostly one or the other
  const flat = new Uint8Array(colors.length).fill(255);
  for (let pixel = 0, sample = 0; pixel < alphas.length; pixel++, sample += components) {
    const alpha = alphas[pixel] ?? 0;
    if (alpha === 0) continue;
    for (let channel = sample; channel < sample + components; channel++) {
      const color = colors[channel] ?? 0;
      // Rounded, in integers; byte by byte, as millions of subarray copies are an order of magnitude slower
      flat[channel] = alpha === 255 ? color : (color * alpha + 255 * (255 - alpha) + 127) / 255;
    }
  }

  // The same image, at the same reference, without its mask; the mask itself is left unused
  const dict = new Map(image.dict.entries());
  dict.delete(name("SMask"));
  dict.delete(name("Length"));
  dict.set(name("Filter"), name("FlateDecode"));
  doc.context.assign(ref, PDFRawStream.of(PDFDict.fromMapWithContext(dict, doc.context), await deflate(flat)));
  return true;
}

/** Whether resources set transparency of their own, through graphics states, so that their group must stay */
function hasTransparentStates(resources: PDFDict): boolean {
  const states = resources.lookupMaybe(name("ExtGState"), PDFDict);
  return states !== undefined && states.entries().length > 0;
}

/**
 * Flatten the soft-masked images that resources draw, forms included; returns whether any transparency is left
 */
async function flattenResources(doc: PDFDocument, resources: PDFDict, seen: Set<PDFRef>): Promise<boolean> {
  let transparent = hasTransparentStates(resources);
  const xObjects = resources.lookupMaybe(name("XObject"), PDFDict);

  for (const ref of xObjects?.values() ?? []) {
    const object = ref instanceof PDFRef ? doc.context.lookup(ref) : undefined;
    if (!(ref instanceof PDFRef) || !(object instanceof PDFRawStream) || seen.has(ref)) continue;
    seen.add(ref);

    const subtype = entry(object.dict, "Subtype");
    if (subtype === name("Image") && entry(object.dict, "SMask") !== undefined) {
      transparent = !(await flattenImage(doc, ref, object)) || transparent;
    } else if (subtype === name("Form")) {
      const formResources = object.dict.lookupMaybe(name("Resources"), PDFDict);
      const formTransparent = formResources ? await flattenResources(doc, formResources, seen) : false;
      // A transparency group with nothing transparent left in it only makes printers flatten for nothing
      if (formTransparent) {
        transparent = true;
      } else {
        object.dict.delete(name("Group"));
      }
    }
  }
  return transparent;
}

/**
 * Flatten the transparency of a PDF's first page onto white, as far as it can be done exactly
 */
export async function flattenFirstPage(doc: PDFDocument): Promise<void> {
  const page = doc.getPages()[0];
  const resources = page?.node.Resources();
  if (!page || !resources) return;

  if (!(await flattenResources(doc, resources, new Set()))) {
    page.node.delete(name("Group"));
  }
}
