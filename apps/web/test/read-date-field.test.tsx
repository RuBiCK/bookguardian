import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { localDate } from '@bookguardian/shared';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it, vi } from 'vitest';
import { ReadDateField } from '../src/components/ReadDateField';

const today = localDate();
const shifted = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};

describe('ReadDateField', () => {
  it('renders a native date input holding the value, capped at today', () => {
    render(<ReadDateField value="2020-01-15" onChange={() => undefined} />);
    const input = screen.getByLabelText(en.books.field.readAt);
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2020-01-15');
    expect(input).toHaveAttribute('max', today);
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('saves a past day or today as soon as it is picked', () => {
    const onChange = vi.fn();
    render(<ReadDateField value={today} onChange={onChange} />);
    const input = screen.getByLabelText(en.books.field.readAt);
    fireEvent.change(input, { target: { value: shifted(-3) } });
    expect(onChange).toHaveBeenCalledWith(shifted(-3));
    fireEvent.change(input, { target: { value: today } });
    // Re-picking the saved value is a no-op.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('refuses a future day: shows the error, keeps it in the box, never saves', () => {
    const onChange = vi.fn();
    render(<ReadDateField value="2020-01-15" onChange={onChange} />);
    const input = screen.getByLabelText(en.books.field.readAt);
    fireEvent.change(input, { target: { value: shifted(1) } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(shifted(1));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(en.books.readAtFuture);

    // Fixing it clears the error and saves.
    fireEvent.change(input, { target: { value: '2019-06-01' } });
    expect(onChange).toHaveBeenCalledWith('2019-06-01');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a cleared box (a finished book always keeps a day)', () => {
    const onChange = vi.fn();
    render(<ReadDateField value="2020-01-15" onChange={onChange} />);
    const input = screen.getByLabelText(en.books.field.readAt);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('follows the saved value when it changes from outside (rollback, refetch)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ReadDateField value="2020-01-15" onChange={onChange} />);
    const input = screen.getByLabelText(en.books.field.readAt);
    fireEvent.change(input, { target: { value: shifted(1) } });
    expect(input).toHaveValue(shifted(1));
    rerender(<ReadDateField value="2018-02-02" onChange={onChange} />);
    expect(input).toHaveValue('2018-02-02');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('drops the draft once the save settles, even if the value never moved', async () => {
    // A save that fails before the optimistic update is painted: the box must
    // not keep showing a day that was never stored.
    let settle!: () => void;
    const onChange = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    render(<ReadDateField value="2020-01-15" onChange={onChange} />);
    const input = screen.getByLabelText(en.books.field.readAt);
    fireEvent.change(input, { target: { value: '2019-05-05' } });
    expect(input).toHaveValue('2019-05-05');
    settle();
    await waitFor(() => expect(input).toHaveValue('2020-01-15'));

    // A rejected promise is treated the same way (the caller already toasted).
    onChange.mockImplementation(() => Promise.reject(new Error('nope')));
    fireEvent.change(input, { target: { value: '2019-06-06' } });
    await waitFor(() => expect(input).toHaveValue('2020-01-15'));
  });

  it('can be labelled from outside through its id', () => {
    render(
      <>
        <label htmlFor="read-at">Finished</label>
        <ReadDateField id="read-at" value="2020-01-15" onChange={() => undefined} />
      </>,
    );
    expect(screen.getByLabelText('Finished')).toHaveAttribute('type', 'date');
  });
});
