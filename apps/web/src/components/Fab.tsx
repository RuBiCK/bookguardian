import { PlusIcon } from './icons';

interface FabProps {
  label: string;
  onClick: () => void;
}

/** Floating action button pinned above the tab bar, on the thumb side. */
export function Fab({ label, onClick }: FabProps) {
  return (
    <button type="button" className="fab" aria-label={label} onClick={onClick} data-testid="fab">
      <PlusIcon />
    </button>
  );
}
