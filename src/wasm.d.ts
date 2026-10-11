/** WebAssembly imported `with { type: "file" }`: the URL of the file, emitted next to the bundle */
declare module "*.wasm" {
  const url: string;
  export default url;
}
