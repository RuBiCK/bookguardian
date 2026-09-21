import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DISMISS_DISTANCE, Sheet } from '../src/components/Sheet';

function Host({ footer = false }: { footer?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet
        open={open}
        title="Sheet title"
        onClose={() => setOpen(false)}
        footer={footer ? <button type="button">Save</button> : undefined}
      >
        <input aria-label="Name" />
        <button type="button">Second</button>
      </Sheet>
    </>
  );
}

const pointer = (el: Element, type: string, y: number) =>
  fireEvent(el, new MouseEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: y }));

afterEach(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
  document.body.style.overflow = '';
});

describe('Sheet', () => {
  it('moves focus in, traps Tab inside, and hands focus back to the opener on close', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Sheet title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    // Tab cycles: Name → Second → Close → Name; Shift+Tab goes the other way.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: en.common.close })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: en.common.close })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on backdrop tap and pads the body for the home indicator when there is no footer', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toHaveClass('sheet__panel--no-footer');
    fireEvent.click(document.querySelector('.sheet__backdrop')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('follows a finger dragging the grip and dismisses past the threshold', async () => {
    const user = userEvent.setup();
    render(<Host footer />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    const header = dialog.querySelector('.sheet__header')!;
    expect(dialog).not.toHaveClass('sheet__panel--no-footer');

    // A short pull springs back.
    pointer(header, 'pointerdown', 100);
    pointer(header, 'pointermove', 130);
    expect(dialog).toHaveAttribute('data-dragging', 'true');
    expect(dialog.style.transform).toBe('translateY(30px)');
    pointer(header, 'pointerup', 130);
    expect(dialog).toHaveAttribute('data-settling', 'true');
    expect(dialog.style.transform).toBe('');
    fireEvent.transitionEnd(dialog);
    expect(dialog).not.toHaveAttribute('data-settling');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Dragging upwards never moves it; a cancelled gesture resets.
    pointer(header, 'pointerdown', 100);
    pointer(header, 'pointermove', 60);
    expect(dialog.style.transform).toBe('');
    fireEvent.pointerCancel(header);

    // A pull past the threshold closes it.
    pointer(header, 'pointerdown', 100);
    pointer(header, 'pointermove', 100 + DISMISS_DISTANCE + 10);
    pointer(header, 'pointerup', 100 + DISMISS_DISTANCE + 10);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores drags that start on the close button', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const close = screen.getByRole('button', { name: en.common.close });
    pointer(close, 'pointerdown', 100);
    pointer(close, 'pointermove', 300);
    pointer(close, 'pointerup', 300);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog').style.transform).toBe('');
  });

  it('stays mounted for its exit animation where the platform can animate', async () => {
    const finished: (() => void)[] = [];
    const animate = vi.fn((_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) => ({
      finished: new Promise<void>((resolve) => finished.push(resolve)),
      cancel: vi.fn(),
    }));
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;

    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    // Still there, sliding out…
    const sheet = screen.getByTestId('sheet');
    expect(sheet).toHaveAttribute('data-state', 'closing');
    expect(animate).toHaveBeenCalledTimes(2); // panel + backdrop
    expect(animate.mock.calls[0]![0]).toEqual([
      { transform: 'none' },
      { transform: 'translateY(100%)' },
    ]);
    // …and gone once both animations finish.
    finished.forEach((resolve) => resolve());
    await waitFor(() => expect(screen.queryByTestId('sheet')).not.toBeInTheDocument());

    // Reopening mid-exit cancels the exit and shows the sheet again.
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-state', 'closing');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
