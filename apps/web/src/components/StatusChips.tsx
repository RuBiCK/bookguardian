import { READ_STATUSES, type ReadStatus } from '@bookguardian/shared';
import { useTranslation } from 'react-i18next';

interface StatusChipsProps {
  value: ReadStatus | undefined;
  onChange: (value: ReadStatus | undefined) => void;
}

/** Horizontal filter chips: All / To read / Reading / Read. */
export function StatusChips({ value, onChange }: StatusChipsProps) {
  const { t } = useTranslation();
  const options: (ReadStatus | undefined)[] = [undefined, ...READ_STATUSES];
  return (
    <div className="chips" role="group" aria-label={t('readStatus.label')}>
      {options.map((option) => (
        <button
          key={option ?? 'all'}
          type="button"
          className="chip"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {t(`readStatus.${option ?? 'all'}`)}
        </button>
      ))}
    </div>
  );
}
