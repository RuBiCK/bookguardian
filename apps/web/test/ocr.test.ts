import { beforeEach, describe, expect, it, vi } from 'vitest';

const recognize = vi.fn();
const terminate = vi.fn();
let logger: ((m: { status: string; progress: number }) => void) | undefined;
let failCreate = false;
const createWorker = vi.fn((lang: string, oem: number, options: { logger: typeof logger }) => {
  logger = options.logger;
  if (failCreate) return Promise.reject(new Error('offline'));
  return Promise.resolve({ recognize, terminate, lang, oem });
});

vi.mock('tesseract.js', () => ({ createWorker }));

import type * as OcrModule from '../src/lib/ocr';

type Ocr = typeof OcrModule;

describe('ocr', () => {
  let ocr: Ocr;

  beforeEach(async () => {
    vi.resetModules();
    ocr = await import('../src/lib/ocr');
    recognize.mockReset();
    terminate.mockReset();
    createWorker.mockClear();
    failCreate = false;
    logger = undefined;
  });

  it('creates one English worker, reports progress per call and returns the text', async () => {
    let finish: (value: { data: { text: string } }) => void = () => undefined;
    recognize.mockImplementationOnce(
      () =>
        new Promise<{ data: { text: string } }>((resolve) => {
          finish = resolve;
        }),
    );
    recognize.mockResolvedValue({ data: { text: 'again' } });
    const file = new Blob(['x'], { type: 'image/png' });
    const first = vi.fn();
    const promise = ocr.recognizeText(file, { onProgress: first });
    await vi.waitFor(() => expect(recognize).toHaveBeenCalled());
    logger!({ status: 'loading tesseract core', progress: 0.5 });
    logger!({ status: 'recognizing text', progress: 0.25 });
    finish({ data: { text: 'DUNE\nFrank Herbert' } });
    expect(await promise).toBe('DUNE\nFrank Herbert');
    expect(first).toHaveBeenCalledWith({ phase: 'loading', progress: 0.5 });
    expect(first).toHaveBeenCalledWith({ phase: 'recognizing', progress: 0.25 });
    expect(createWorker).toHaveBeenCalledWith('eng', 1, expect.objectContaining({ logger }));
    // jsdom has no createImageBitmap: the blob is handed over as-is.
    expect(recognize).toHaveBeenCalledWith(file);

    const second = vi.fn();
    await ocr.recognizeText(file, { onProgress: second });
    expect(createWorker).toHaveBeenCalledTimes(1);
    logger!({ status: 'recognizing text', progress: 1 });
    expect(second).not.toHaveBeenCalled(); // finished calls stop listening
    expect(first).toHaveBeenCalledTimes(2);
  });

  it('retries worker creation after a failed download and can release the worker', async () => {
    failCreate = true;
    await expect(ocr.recognizeText(new Blob(['x']))).rejects.toThrow('offline');
    failCreate = false;
    recognize.mockResolvedValue({ data: { text: 'ok' } });
    expect(await ocr.recognizeText(new Blob(['x']))).toBe('ok');
    expect(createWorker).toHaveBeenCalledTimes(2);
    await ocr.releaseOcrWorker();
    expect(terminate).toHaveBeenCalledTimes(1);
    await ocr.releaseOcrWorker(); // nothing to release
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('downscales large photos onto a canvas when the browser can decode them', async () => {
    const close = vi.fn();
    const bitmap = { width: 4000, height: 3000, close };
    const drawImage = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    try {
      const canvas = (await ocr.downscale(new Blob(['x']), 1600)) as HTMLCanvasElement;
      expect(canvas.tagName).toBe('CANVAS');
      expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
      expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
      expect(close).toHaveBeenCalled();

      // Small photos are not upscaled.
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue({ ...bitmap, width: 800, height: 600 }),
      );
      const small = (await ocr.downscale(new Blob(['x']))) as HTMLCanvasElement;
      expect([small.width, small.height]).toEqual([800, 600]);

      // Undecodable input or a canvas without 2D context falls back to the blob.
      vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad image')));
      const blob = new Blob(['x']);
      expect(await ocr.downscale(blob)).toBe(blob);
      vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
      getContext.mockReturnValueOnce(null);
      expect(await ocr.downscale(blob)).toBe(blob);
    } finally {
      vi.unstubAllGlobals();
      getContext.mockRestore();
    }
  });
});
