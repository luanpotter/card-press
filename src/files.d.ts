/**
 * Files imported `with { type: "file" }`: the URL of the file, emitted next to the bundle.
 * They are fetched only when used, rather than inlined into the JavaScript.
 */

declare module "*.wasm" {
  const url: string;
  export default url;
}

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.jpg" {
  const url: string;
  export default url;
}

declare module "*.pdf" {
  const url: string;
  export default url;
}
