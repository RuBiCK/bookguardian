/**
 * ISBN barcode scanning on top of `@zxing/browser`, loaded lazily so the
 * decoder (~300 kB) is only fetched when the Scan tab actually needs it.
 */
import { isBooklandEan } from '@bookguardian/shared';
import type { DecodeHintType as DecodeHint } from '@zxing/library';

export type CameraFailure = 'denied' | 'unavailable' | 'failed';

export class CameraError extends Error {
  constructor(public readonly reason: CameraFailure) {
    super(`camera ${reason}`);
    this.name = 'CameraError';
  }
}

export interface BarcodeScanner {
  stop(): void;
}

async function loadReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map<DecodeHint, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 150,
    delayBetweenScanSuccess: 1500,
  });
}

/** Whether this browser can even ask for a camera (not in every WebView / insecure context). */
export function hasCameraSupport(nav: Pick<Navigator, 'mediaDevices'> = navigator): boolean {
  return typeof nav.mediaDevices?.getUserMedia === 'function';
}

export function cameraFailure(error: unknown): CameraFailure {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'denied';
  }
  if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'DevicesNotFoundError'
  ) {
    return 'unavailable';
  }
  return 'failed';
}

/**
 * Stream the rear camera into `video` and call `onIsbn` with the first
 * Bookland EAN-13 (978/979) seen. Non-book barcodes are ignored. Resolves
 * once the stream is live; rejects with `CameraError` when it cannot start.
 */
export async function startIsbnScanner(
  video: HTMLVideoElement,
  onIsbn: (isbn13: string) => void,
): Promise<BarcodeScanner> {
  if (!hasCameraSupport()) throw new CameraError('unavailable');
  const reader = await loadReader();
  let stopped = false;
  try {
    const controls = await reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      video,
      (result) => {
        if (stopped || !result) return;
        const text = result.getText();
        if (isBooklandEan(text)) onIsbn(text);
      },
    );
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        controls.stop();
      },
    };
  } catch (error) {
    throw new CameraError(cameraFailure(error));
  }
}

/** Decode a barcode from a photo/screenshot; `null` when none is found. */
export async function decodeIsbnFromImage(file: Blob): Promise<string | null> {
  const reader = await loadReader();
  const url = URL.createObjectURL(file);
  try {
    const result = await reader.decodeFromImageUrl(url);
    const text = result.getText();
    return isBooklandEan(text) ? text : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
