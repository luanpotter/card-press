import workerUrl from "@/generated/rasterWorker.js" with { type: "file" };
import type { CardRaster, RasterRendering, RasterSource } from "@/utils/cardRaster";
import type { RasterRequest, RasterResponse } from "@/workers/rasterWorker";

/** Image workers, rasterizing several cards at once without blocking the page */
export interface RasterWorkers {
  /**
   * Rasterize a card on the next free worker.
   * Its source is only prepared then, as decoded pixels take a lot of memory; nothing starts once aborted.
   */
  rasterize: (
    prepare: () => Promise<RasterSource>,
    rendering: RasterRendering,
    signal?: AbortSignal
  ) => Promise<CardRaster>;
}

// Each holds a few full-size images at once, so beyond a handful they would cost memory more than save time
const MAX_WORKERS = 4;

function startWorker(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(workerUrl, location.href), { type: "module" });
    // Its first message says it loaded
    worker.onmessage = () => resolve(worker);
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "An image worker failed to load"));
    };
  });
}

/** Have a worker rasterize a card, transferring rather than copying its buffers */
function post(worker: Worker, request: RasterRequest): Promise<CardRaster> {
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<RasterResponse>) => {
      if ("error" in data) {
        reject(new Error(data.error));
      } else {
        resolve(data.raster);
      }
    };
    worker.onerror = (event) => reject(new Error(event.message));

    const { source } = request;
    const transfer =
      source.kind === "pixels" ? [source.pixels.data.buffer] : source.kind === "svg" ? [source.svg.buffer] : [];
    worker.postMessage(request, { transfer });
  });
}

/** Start the image workers, one per spare core up to a handful, once each has loaded */
export async function startRasterWorkers(): Promise<RasterWorkers> {
  const count = Math.max(1, Math.min(MAX_WORKERS, navigator.hardwareConcurrency - 1));
  const idle = await Promise.all(Array.from({ length: count }, startWorker));
  const waiting: ((worker: Worker) => void)[] = [];

  const acquire = (): Promise<Worker> => {
    const worker = idle.pop();
    return worker ? Promise.resolve(worker) : new Promise((resolve) => waiting.push(resolve));
  };
  const release = (worker: Worker) => {
    const next = waiting.shift();
    if (next) {
      next(worker);
    } else {
      idle.push(worker);
    }
  };

  return {
    rasterize: async (prepare, rendering, signal) => {
      const worker = await acquire();
      try {
        signal?.throwIfAborted();
        return await post(worker, { source: await prepare(), rendering });
      } finally {
        release(worker);
      }
    },
  };
}
