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

export const loadSvgRenderer = lazyModule("SVG renderer", "resvg, for raster SVG output", () =>
  import("@/utils/renderSvg").then(({ loadResvg }) => loadResvg())
);

export const loadVectorSvg = lazyModule(
  "Vector SVG",
  "jsPDF and svg2pdf.js, for vector SVG output",
  () => import("@/utils/svgToPdf")
);

/** Start every download, for each to be ready by the time it is needed; failures show in their status */
export function preloadModules(): void {
  for (const { download } of snapshot) {
    download().catch(() => undefined);
  }
}
