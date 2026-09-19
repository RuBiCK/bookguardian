/**
 * On-device OCR with `tesseract.js`. The library, its WASM core and the
 * English traineddata are fetched lazily the first time a cover is read
 * (and cached by the browser / IndexedDB afterwards), so the app shell
 * stays small.
 */
import type { Worker } from 'tesseract.js';

export type OcrPhase = 'loading' | 'recognizing';

export interface OcrProgress {
  phase: OcrPhase;
  /** 0–1 within the current phase. */
  progress: number;
}

export interface OcrOptions {
  onProgress?: (progress: OcrProgress) => void;
  /** Longest side the photo is downscaled to before OCR; phones shoot 12 MP, Tesseract wants ~1.5 MP. */
  maxSide?: number;
}

const MAX_SIDE = 1600;

let workerPromise: Promise<Worker> | null = null;
// The worker is created once; its logger reports to whichever call is running now.
let currentProgress: OcrOptions['onProgress'];

function report(message: { status: string; progress: number }) {
  currentProgress?.({
    phase: message.status === 'recognizing text' ? 'recognizing' : 'loading',
    progress: message.progress,
  });
}

function getWorker(): Promise<Worker> {
  workerPromise ??= import('tesseract.js')
    .then(({ createWorker }) => createWorker('eng', 1, { logger: report }))
    .catch((error: unknown) => {
      workerPromise = null; // let the next attempt retry the download
      throw error;
    });
  return workerPromise;
}

/** Drop the cached worker (tests, memory pressure). */
export async function releaseOcrWorker(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (pending) await (await pending).terminate();
}

/** Downscale a photo onto a canvas so OCR runs in seconds rather than minutes. */
export async function downscale(file: Blob, maxSide = MAX_SIDE): Promise<HTMLCanvasElement | Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Recognise the text in a cover photo; the caller turns it into search queries. */
export async function recognizeText(file: Blob, options: OcrOptions = {}): Promise<string> {
  currentProgress = options.onProgress;
  try {
    const worker = await getWorker();
    const image = await downscale(file, options.maxSide);
    const {
      data: { text },
    } = await worker.recognize(image);
    return text;
  } finally {
    if (currentProgress === options.onProgress) currentProgress = undefined;
  }
}
