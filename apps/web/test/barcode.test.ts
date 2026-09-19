import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BarcodeModule from '../src/lib/barcode';

type Barcode = typeof BarcodeModule;

const decodeFromConstraints = vi.fn();
const decodeFromImageUrl = vi.fn();
const revokeObjectURL = vi.fn();
const constructed: unknown[] = [];

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    constructor(hints: unknown, options: unknown) {
      constructed.push({ hints, options });
    }
    decodeFromConstraints = decodeFromConstraints;
    decodeFromImageUrl = decodeFromImageUrl;
  },
}));

vi.mock('@zxing/library', () => ({
  BarcodeFormat: { EAN_13: 'EAN_13' },
  DecodeHintType: { POSSIBLE_FORMATS: 'POSSIBLE_FORMATS', TRY_HARDER: 'TRY_HARDER' },
}));

const result = (text: string) => ({ getText: () => text });
const named = (name: string) => Object.assign(new Error(name), { name });

describe('barcode', () => {
  let barcode: Barcode;
  let video: HTMLVideoElement;

  beforeEach(async () => {
    vi.resetModules();
    barcode = await import('../src/lib/barcode');
    video = document.createElement('video');
    decodeFromConstraints.mockReset();
    decodeFromImageUrl.mockReset();
    constructed.length = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });

  it('detects camera support and classifies getUserMedia failures', () => {
    expect(barcode.hasCameraSupport()).toBe(true);
    expect(barcode.hasCameraSupport({ mediaDevices: undefined } as never)).toBe(false);
    expect(barcode.cameraFailure(named('NotAllowedError'))).toBe('denied');
    expect(barcode.cameraFailure(named('SecurityError'))).toBe('denied');
    expect(barcode.cameraFailure(named('NotFoundError'))).toBe('unavailable');
    expect(barcode.cameraFailure(named('OverconstrainedError'))).toBe('unavailable');
    expect(barcode.cameraFailure(new Error('x'))).toBe('failed');
    expect(barcode.cameraFailure('string')).toBe('failed');
  });

  it('streams the rear camera, reports only Bookland EAN-13s and stops once', async () => {
    const stop = vi.fn();
    let callback: (r: unknown) => void = () => undefined;
    decodeFromConstraints.mockImplementation(
      (constraints: MediaStreamConstraints, el: HTMLVideoElement, cb: (r: unknown) => void) => {
        expect(constraints).toEqual({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        expect(el).toBe(video);
        callback = cb;
        return Promise.resolve({ stop });
      },
    );
    const onIsbn = vi.fn();
    const scanner = await barcode.startIsbnScanner(video, onIsbn);
    expect(constructed[0]).toMatchObject({
      options: { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 1500 },
    });
    const hints = (constructed[0] as { hints: Map<string, unknown> }).hints;
    expect(hints.get('POSSIBLE_FORMATS')).toEqual(['EAN_13']);
    expect(hints.get('TRY_HARDER')).toBe(true);

    callback(undefined);
    callback(result('5901234123457')); // groceries
    callback(result('9780441013594')); // bad check digit
    expect(onIsbn).not.toHaveBeenCalled();
    callback(result('9780441013593'));
    expect(onIsbn).toHaveBeenCalledWith('9780441013593');

    scanner.stop();
    scanner.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    callback(result('9780441013593'));
    expect(onIsbn).toHaveBeenCalledTimes(1);
  });

  it('turns start-up failures into CameraError', async () => {
    decodeFromConstraints.mockRejectedValue(named('NotAllowedError'));
    await expect(barcode.startIsbnScanner(video, vi.fn())).rejects.toMatchObject({
      name: 'CameraError',
      reason: 'denied',
    });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await expect(barcode.startIsbnScanner(video, vi.fn())).rejects.toMatchObject({
      reason: 'unavailable',
    });
  });

  it('decodes photos and returns null when nothing usable is found', async () => {
    const file = new Blob(['x'], { type: 'image/png' });
    decodeFromImageUrl.mockResolvedValueOnce(result('9780441013593'));
    expect(await barcode.decodeIsbnFromImage(file)).toBe('9780441013593');
    expect(decodeFromImageUrl).toHaveBeenCalledWith('blob:x');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    decodeFromImageUrl.mockResolvedValueOnce(result('5901234123457'));
    expect(await barcode.decodeIsbnFromImage(file)).toBeNull();
    decodeFromImageUrl.mockRejectedValueOnce(new Error('NotFoundException'));
    expect(await barcode.decodeIsbnFromImage(file)).toBeNull();
  });
});
