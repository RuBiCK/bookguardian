import type { BookDraft } from '@bookguardian/shared';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isbnLookupQueryOptions, searchFirstMatch } from '../api/lookup';
import { BookSheet } from '../components/BookSheet';
import { CandidatesSheet } from '../components/CandidatesSheet';
import { CaptureResultSheet } from '../components/CaptureResultSheet';
import { CameraIcon, ImageIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import {
  decodeIsbnFromImage,
  hasCameraSupport,
  startIsbnScanner,
  type BarcodeScanner,
  type CameraFailure,
} from '../lib/barcode';
import { parseIsbn } from '../lib/format';
import { recognizeText, type OcrPhase } from '../lib/ocr';
import { interpretOcr } from '../lib/ocr-query';

export const Route = createFileRoute('/scan')({
  component: ScanScreen,
});

type Mode = 'isbn' | 'cover';

type NoticeKey =
  | 'scan.noBarcode'
  | 'scan.cover.ocrFailed'
  | 'scan.cover.noText'
  | 'scan.cover.noMatches'
  | 'scan.result.lookupFailed';

type CameraState =
  { status: 'idle' | 'starting' | 'live' | 'paused' } | { status: 'error'; reason: CameraFailure };

/** What the screen is busy with; sheets open from the terminal stages. */
type Stage =
  | { kind: 'idle' }
  | { kind: 'lookup'; isbn13: string }
  | { kind: 'ocr'; phase: OcrPhase; progress: number }
  | { kind: 'searching' }
  | { kind: 'result'; draft: BookDraft }
  | { kind: 'candidates'; items: BookDraft[]; titleGuess: string }
  | { kind: 'notFound'; isbn13: string }
  | { kind: 'manual'; draft: Partial<BookDraft> }
  | { kind: 'notice'; message: NoticeKey; query?: string; titleGuess?: string };

const IDLE: Stage = { kind: 'idle' };
const CAMERA_MESSAGE = {
  denied: 'scan.camera.denied',
  unavailable: 'scan.camera.unavailable',
  failed: 'scan.camera.failed',
} as const satisfies Record<CameraFailure, string>;

/**
 * Scan tab: live ISBN barcode scanning (or a photo of the barcode, or a typed
 * ISBN) and cover OCR, both ending in a pre-filled "Add to <shelf>" sheet.
 */
function ScanScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formId = useId();
  const [mode, setMode] = useState<Mode>('isbn');
  const [stage, setStage] = useState<Stage>(IDLE);
  const [camera, setCamera] = useState<CameraState>({ status: 'idle' });
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualError, setManualError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isbnFileRef = useRef<HTMLInputElement>(null);
  const coverCameraRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  // Bumped whenever a new capture starts so a slow OCR/lookup cannot clobber a newer one.
  const runRef = useRef(0);

  const beginRun = () => {
    runRef.current += 1;
    return runRef.current;
  };
  const stillCurrent = (run: number) => runRef.current === run;

  /**
   * Fetch the draft for an ISBN and move to the result / not-found stage.
   * `quietMiss` keeps the stage untouched on a miss so a caller can try
   * something else (cover OCR falls back to a title search).
   */
  const lookup = useCallback(
    async (
      isbn13: string,
      run: number,
      quietMiss = false,
    ): Promise<BookDraft | null | undefined> => {
      setStage({ kind: 'lookup', isbn13 });
      try {
        const draft = await queryClient.fetchQuery(isbnLookupQueryOptions(isbn13));
        if (!stillCurrent(run)) return undefined;
        if (draft) setStage({ kind: 'result', draft });
        else if (!quietMiss) setStage({ kind: 'notFound', isbn13 });
        return draft;
      } catch {
        if (stillCurrent(run)) setStage({ kind: 'notice', message: 'scan.result.lookupFailed' });
        return undefined;
      }
    },
    [queryClient],
  );

  // Live camera scanning while the ISBN mode is idle and nothing is open on top.
  const scanning = mode === 'isbn' && stage.kind === 'idle';
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    if (!video) return;
    if (!hasCameraSupport()) {
      setCamera({ status: 'error', reason: 'unavailable' });
      return;
    }
    let scanner: BarcodeScanner | undefined;
    let cancelled = false;
    setCamera({ status: 'starting' });
    startIsbnScanner(video, (isbn13) => {
      if (cancelled) return;
      scanner?.stop();
      setCamera({ status: 'paused' });
      void lookup(isbn13, beginRun());
    })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        scanner = controls;
        setCamera({ status: 'live' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const reason =
          error instanceof Error && 'reason' in error
            ? (error as { reason: CameraFailure }).reason
            : 'failed';
        setCamera({ status: 'error', reason });
      });
    return () => {
      cancelled = true;
      scanner?.stop();
    };
  }, [scanning, cameraAttempt, lookup]);

  const reset = () => {
    beginRun();
    setStage(IDLE);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    beginRun();
    setStage(IDLE);
    setCamera({ status: 'idle' });
    setMode(next);
  };

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseIsbn(manualIsbn);
    if (!parsed || parsed === 'invalid') {
      setManualError(true);
      return;
    }
    setManualError(false);
    setManualIsbn('');
    void lookup(parsed.isbn13, beginRun());
  };

  const onIsbnPhoto = async (file: File | undefined) => {
    if (!file) return;
    const run = beginRun();
    setStage({ kind: 'lookup', isbn13: '…' });
    const isbn13 = await decodeIsbnFromImage(file);
    if (!stillCurrent(run)) return;
    if (!isbn13) {
      setStage({ kind: 'notice', message: 'scan.noBarcode' });
      return;
    }
    await lookup(isbn13, run);
  };

  const onCoverPhoto = async (file: File | undefined) => {
    if (!file) return;
    const run = beginRun();
    setStage({ kind: 'ocr', phase: 'loading', progress: 0 });
    let text: string;
    try {
      text = await recognizeText(file, {
        onProgress: ({ phase, progress }) => {
          if (stillCurrent(run)) setStage({ kind: 'ocr', phase, progress });
        },
      });
    } catch {
      if (stillCurrent(run)) setStage({ kind: 'notice', message: 'scan.cover.ocrFailed' });
      return;
    }
    if (!stillCurrent(run)) return;

    const guess = interpretOcr(text);
    // A printed ISBN (back cover, copyright page) beats any fuzzy title search.
    if (guess.isbn13) {
      const draft = await lookup(guess.isbn13, run, true);
      if (draft || !stillCurrent(run)) return;
    }
    if (guess.queries.length === 0) {
      setStage({ kind: 'notice', message: 'scan.cover.noText', titleGuess: guess.titleGuess });
      return;
    }
    setStage({ kind: 'searching' });
    try {
      const { query, items } = await searchFirstMatch(guess.queries);
      if (!stillCurrent(run)) return;
      setStage(
        items.length > 0
          ? { kind: 'candidates', items: items.slice(0, 5), titleGuess: guess.titleGuess }
          : {
              kind: 'notice',
              message: 'scan.cover.noMatches',
              query,
              titleGuess: guess.titleGuess,
            },
      );
    } catch {
      if (stillCurrent(run)) setStage({ kind: 'notice', message: 'scan.result.lookupFailed' });
    }
  };

  const pickFile = (ref: React.RefObject<HTMLInputElement | null>) => () => ref.current?.click();
  const fileChange =
    (handler: (file: File | undefined) => Promise<void>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // allow re-picking the same photo
      void handler(file);
    };

  const cameraText = () => {
    if (stage.kind === 'lookup') return t('scan.lookingUp', { isbn: stage.isbn13 });
    switch (camera.status) {
      case 'live':
        return t('scan.camera.ready');
      case 'starting':
        return t('scan.camera.starting');
      case 'paused':
        return t('scan.camera.stopped');
      case 'error':
        return t(CAMERA_MESSAGE[camera.reason]);
      default:
        return '';
    }
  };

  const busy = stage.kind === 'lookup' || stage.kind === 'ocr' || stage.kind === 'searching';

  const progressText = () => {
    if (stage.kind === 'ocr') {
      const percent = Math.round(stage.progress * 100);
      return stage.phase === 'loading'
        ? t('scan.cover.loadingOcr', { percent })
        : t('scan.cover.reading', { percent });
    }
    if (stage.kind === 'lookup') return t('scan.lookingUp', { isbn: stage.isbn13 });
    return t('scan.cover.searching');
  };

  const noticeText = () => {
    if (stage.kind !== 'notice') return '';
    return stage.message === 'scan.cover.noMatches'
      ? t('scan.cover.noMatches', { query: stage.query ?? '' })
      : t(stage.message);
  };

  return (
    <Screen title={t('scan.title')}>
      <div className="segmented segmented--block" role="group" aria-label={t('scan.mode.label')}>
        {(['isbn', 'cover'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="segmented__option"
            aria-pressed={mode === option}
            onClick={() => switchMode(option)}
          >
            {t(`scan.mode.${option}`)}
          </button>
        ))}
      </div>

      {mode === 'isbn' ? (
        <>
          <div className="scanner" data-testid="scanner" data-state={camera.status}>
            <video
              ref={videoRef}
              className="scanner__video"
              playsInline
              muted
              autoPlay
              aria-label={t('scan.camera.preview')}
            />
            <span className="scanner__frame" aria-hidden="true" />
            {camera.status !== 'live' ? <p className="scanner__message">{cameraText()}</p> : null}
          </div>
          <p className="scanner__status" role="status" data-testid="scanner-status">
            {cameraText()}
          </p>
          {camera.status === 'paused' || camera.status === 'error' ? (
            <button
              type="button"
              className="button button--block"
              disabled={busy}
              onClick={() => {
                reset();
                setCameraAttempt((n) => n + 1);
              }}
            >
              {t('scan.camera.resume')}
            </button>
          ) : null}

          <div className="button-row scan__actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={pickFile(isbnFileRef)}
            >
              <ImageIcon /> {t('scan.pickPhoto')}
            </button>
          </div>
          <input
            ref={isbnFileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            tabIndex={-1}
            data-testid="isbn-photo"
            onChange={fileChange(onIsbnPhoto)}
          />

          <form className="form scan__manual" onSubmit={submitManual} noValidate>
            <div className={`field${manualError ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor={`${formId}-isbn`}>
                {t('scan.manual.label')}
              </label>
              <div className="field__row">
                <input
                  id={`${formId}-isbn`}
                  className="field__input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t('scan.manual.placeholder')}
                  value={manualIsbn}
                  aria-invalid={manualError || undefined}
                  aria-describedby={manualError ? `${formId}-isbn-error` : undefined}
                  onChange={(event) => {
                    setManualIsbn(event.target.value);
                    setManualError(false);
                  }}
                />
                <button type="submit" className="button" disabled={busy || !manualIsbn.trim()}>
                  {t('scan.manual.submit')}
                </button>
              </div>
              {manualError ? (
                <p id={`${formId}-isbn-error`} className="field__error">
                  {t('books.isbnInvalid')}
                </p>
              ) : null}
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="muted">{t('scan.cover.hint')}</p>
          <div className="stack scan__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={pickFile(coverCameraRef)}
            >
              <CameraIcon /> {t('scan.takePhoto')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={pickFile(coverFileRef)}
            >
              <ImageIcon /> {t('scan.pickPhoto')}
            </button>
          </div>
          <input
            ref={coverCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            tabIndex={-1}
            data-testid="cover-camera"
            onChange={fileChange(onCoverPhoto)}
          />
          <input
            ref={coverFileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            tabIndex={-1}
            data-testid="cover-photo"
            onChange={fileChange(onCoverPhoto)}
          />

          {stage.kind === 'ocr' || stage.kind === 'searching' || stage.kind === 'lookup' ? (
            <div className="progress" role="status" data-testid="cover-progress">
              <span className="progress__label">{progressText()}</span>
              <span className="progress__track" aria-hidden="true">
                <span
                  className={`progress__bar${stage.kind === 'ocr' ? '' : ' progress__bar--busy'}`}
                  style={stage.kind === 'ocr' ? { width: `${stage.progress * 100}%` } : undefined}
                />
              </span>
            </div>
          ) : null}
        </>
      )}

      {stage.kind === 'notice' ? (
        <div className="notice" role="alert" data-testid="scan-notice">
          <p>{noticeText()}</p>
          <div className="button-row">
            <button type="button" className="button button--small" onClick={reset}>
              {t('scan.cover.tryAgain')}
            </button>
            {mode === 'cover' ? (
              <button
                type="button"
                className="button button--small button--ghost"
                onClick={() => setStage({ kind: 'manual', draft: { title: stage.titleGuess } })}
              >
                {t('scan.result.addManually')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <CaptureResultSheet draft={stage.kind === 'result' ? stage.draft : null} onClose={reset} />

      <CandidatesSheet
        open={stage.kind === 'candidates'}
        candidates={stage.kind === 'candidates' ? stage.items : []}
        onPick={(draft) => setStage({ kind: 'result', draft })}
        onClose={reset}
        onAddManually={() =>
          setStage({
            kind: 'manual',
            draft: { title: stage.kind === 'candidates' ? stage.titleGuess : '' },
          })
        }
      />

      <Sheet
        open={stage.kind === 'notFound'}
        onClose={reset}
        title={t('scan.result.notFoundTitle')}
        footer={
          <button
            type="button"
            className="button button--primary button--block"
            onClick={() =>
              setStage({
                kind: 'manual',
                draft: { isbn13: stage.kind === 'notFound' ? stage.isbn13 : null },
              })
            }
          >
            {t('scan.result.addManually')}
          </button>
        }
      >
        <p className="sheet__text">
          {t('scan.result.notFound', { isbn: stage.kind === 'notFound' ? stage.isbn13 : '' })}
        </p>
      </Sheet>

      <BookSheet
        open={stage.kind === 'manual'}
        draft={stage.kind === 'manual' ? stage.draft : undefined}
        onClose={reset}
      />
    </Screen>
  );
}
