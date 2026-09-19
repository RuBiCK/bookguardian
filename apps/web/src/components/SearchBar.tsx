import { useTranslation } from 'react-i18next';
import { CloseIcon, SearchIcon } from './icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const { t } = useTranslation();
  return (
    <div className="search">
      <SearchIcon className="search__icon" />
      <input
        type="search"
        className="search__input"
        value={value}
        placeholder={placeholder}
        aria-label={t('common.search')}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="icon-button search__clear"
          aria-label={t('common.clear')}
          onClick={() => onChange('')}
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
