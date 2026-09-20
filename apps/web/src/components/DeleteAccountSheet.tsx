import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';

interface DeleteAccountSheetProps {
  open: boolean;
  /** The account's email; the user has to type it back before the final button enables. */
  email: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (confirmEmail: string) => void;
}

const sameEmail = (typed: string, email: string) =>
  typed.trim().toLowerCase() === email.trim().toLowerCase();

/**
 * Two-step account deletion: a plain warning first, then the email typed
 * back. The final button only enables once the email matches, so a slip of
 * the thumb cannot wipe a library.
 */
export function DeleteAccountSheet({
  open,
  email,
  busy,
  onClose,
  onConfirm,
}: DeleteAccountSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) {
      setStep(1);
      setTyped('');
    }
  }, [open]);

  const matches = sameEmail(typed, email);
  const showMismatch = typed.trim().length > 0 && !matches;

  if (step === 1) {
    return (
      <Sheet
        open={open}
        title={t('settings.account.deleteTitle')}
        onClose={onClose}
        footer={
          <div className="button-row">
            <button type="button" className="button button--block" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="button button--danger button--block"
              onClick={() => setStep(2)}
            >
              {t('settings.account.deleteContinue')}
            </button>
          </div>
        }
      >
        <p className="sheet__text">{t('settings.account.deleteBody')}</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      title={t('settings.account.confirmTitle')}
      onClose={onClose}
      footer={
        <div className="button-row">
          <button type="button" className="button button--block" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form={formId}
            className="button button--danger button--block"
            disabled={!matches || busy}
          >
            {busy ? t('settings.account.deleting') : t('settings.account.deleteFinal')}
          </button>
        </div>
      }
    >
      <p className="sheet__text">{t('settings.account.confirmBody', { email })}</p>
      <form
        id={formId}
        className="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (matches && !busy) onConfirm(typed.trim());
        }}
      >
        <div className={showMismatch ? 'field field--error' : 'field'}>
          <label className="field__label" htmlFor={`${formId}-email`}>
            {t('settings.account.confirmEmailLabel')}
          </label>
          <input
            id={`${formId}-email`}
            className="field__input"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            placeholder={t('settings.account.confirmEmailPlaceholder')}
            onChange={(e) => setTyped(e.target.value)}
          />
          {showMismatch ? (
            <span className="field__error" role="alert">
              {t('settings.account.mismatch')}
            </span>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}
