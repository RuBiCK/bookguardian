import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';

export interface NameSheetValues {
  name: string;
  location: string;
}

interface NameSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (values: NameSheetValues) => void;
  initial?: Partial<NameSheetValues>;
  nameLabel: string;
  namePlaceholder: string;
  /** Show the optional location field (libraries only). */
  withLocation?: boolean;
}

/** One-field (or two) sheet used to add/rename libraries and shelves. */
export function NameSheet({
  open,
  title,
  onClose,
  onSubmit,
  initial,
  nameLabel,
  namePlaceholder,
  withLocation = false,
}: NameSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setLocation(initial?.location ?? '');
  }, [open, initial?.name, initial?.location]);

  const valid = name.trim().length > 0;

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <button
          type="submit"
          form={formId}
          className="button button--primary button--block"
          disabled={!valid}
        >
          {t('common.save')}
        </button>
      }
    >
      <form
        id={formId}
        className="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onSubmit({ name: name.trim(), location: location.trim() });
          onClose();
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor={`${formId}-name`}>
            {nameLabel}
          </label>
          <input
            id={`${formId}-name`}
            className="field__input"
            value={name}
            placeholder={namePlaceholder}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {withLocation ? (
          <div className="field">
            <label className="field__label" htmlFor={`${formId}-location`}>
              {t('library.location')} <span className="field__hint">({t('common.optional')})</span>
            </label>
            <input
              id={`${formId}-location`}
              className="field__input"
              value={location}
              placeholder={t('library.locationPlaceholder')}
              autoComplete="off"
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
