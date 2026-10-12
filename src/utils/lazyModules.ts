import { CARD_BACKS } from "@/generated/assets";
import { DEFAULT_TEMPLATES } from "@/types/template";
import { fetchDataUrl } from "@/utils/imageFiles";
import { startRasterWorkers } from "@/utils/rasterWorkers";
import resvgWasmUrl from "@resvg/resvg-wasm/index_bg.wasm" with { type: "file" };

// Bundled, the import is a URL relative to the page; under Bun (in tests), a file path
const RESVG_WASM_URL = new URL(resvgWasmUrl, typeof location === "undefined" ? "file://" : location.href);

/**
 * Parts of the app that are downloaded right after the page shows, rather than with it, so it shows sooner.
 * Using one before its download is done waits for that same download.
 */

/** Where a module's download is, worded for the user */
export enum ModuleStatus {
  Pending = "waiting",
  Loading = "downloading...",
  Ready = "ready",
  Failed = "failed",
}

export interface ModuleState {
  label: string;
  /** What it holds, for the user */
  description: string;
  status: ModuleStatus;
  /** Whether something is waiting for its download */
  needed: boolean;
  error?: string | undefined;
  /** Download it, unless it already is; a failed download starts over */
  download: () => Promise<unknown>;
}

const states = new Map<string, ModuleState>();
const listeners = new Set<() => void>();
let snapshot: ModuleState[] = [];

function update(state: ModuleState): void {
  states.set(state.label, state);
  snapshot = [...states.values()];
  for (const listener of listeners) listener();
}

/** Call back on every status change; returns the unsubscribe function */
export function subscribeModules(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every module, as of the last change (a new array on each change) */
export function getModules(): ModuleState[] {
  return snapshot;
}

/**
 * A module downloaded on its first use, or on preloading; returns the function that gets it
 */
function lazyModule<T>(label: string, description: string, importer: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | undefined;
  let state: ModuleState;
  const set = (changes: Partial<ModuleState>) => {
    state = { ...state, ...changes };
    update(state);
  };

  const download = (): Promise<T> => {
    if (!loading) {
      set({ status: ModuleStatus.Loading, error: undefined });
      loading = importer().then(
        (module) => {
          set({ status: ModuleStatus.Ready, needed: false });
          return module;
        },
        (error: unknown) => {
          loading = undefined;
          set({ status: ModuleStatus.Failed, needed: false, error: String(error) });
          throw error;
        }
      );
    }
    return loading;
  };

  state = { label, description, status: ModuleStatus.Pending, needed: false, download };
  update(state);

  return () => {
    if (state.status !== ModuleStatus.Ready) {
      set({ needed: true });
    }
    return download();
  };
}

export const loadPdfGenerator = lazyModule(
  "PDF generator",
  "pdf-lib and the image pipeline",
  () => import("@/utils/generatePdf")
);

export const loadRasterWorkers = lazyModule(
  "Image workers",
  "decoding and resizing card images, off the page",
  startRasterWorkers
);

/** Compiled once here, for every image worker to instantiate */
export const loadSvgRenderer = lazyModule("SVG renderer", "resvg, for raster SVG output", async () => {
  const response = await fetch(RESVG_WASM_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)}`);
  }
  return await WebAssembly.compile(await response.arrayBuffer());
});

export const loadVectorSvg = lazyModule(
  "Vector SVG",
  "jsPDF and svg2pdf.js, for vector SVG output",
  () => import("@/utils/svgToPdf")
);

/** Download bundled files into data URLs, by URL, as images and PDFs are stored */
async function fetchDataUrls(urls: string[]): Promise<Map<string, string>> {
  return new Map(await Promise.all(urls.map(async (url) => [url, await fetchDataUrl(url)] as const)));
}

export const loadDefaultTemplatePdfs = lazyModule("Default templates", "the Cricut template PDFs", () =>
  fetchDataUrls(DEFAULT_TEMPLATES.flatMap((template) => template.cricut?.bundledPdf?.url ?? []))
);

export const loadDefaultCardBacks = lazyModule("Default card backs", "the bundled card back images", () =>
  fetchDataUrls(CARD_BACKS.map((back) => back.url))
);

/** Start every download, for each to be ready by the time it is needed; failures show in their status */
export function preloadModules(): void {
  for (const { download } of snapshot) {
    download().catch(() => undefined);
  }
}
