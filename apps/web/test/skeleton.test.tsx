import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  BookGridSkeleton,
  BookPageSkeleton,
  CardListSkeleton,
  Skeleton,
  StatsSkeleton,
} from '../src/components/Skeleton';
import { useStoredValue, writeStoredValue } from '../src/lib/stored-value';

describe('skeletons', () => {
  it('announce themselves as busy loading regions, with the shape of the content', () => {
    render(<BookGridSkeleton count={4} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-label', en.common.loading);
    expect(status.querySelectorAll('.skeleton--cover')).toHaveLength(4);
    cleanup();

    render(<CardListSkeleton count={2} />);
    expect(screen.getByRole('status').querySelectorAll('.skeleton-card')).toHaveLength(2);
    cleanup();

    render(<BookPageSkeleton />);
    expect(
      screen.getByRole('status').querySelector('.skeleton-hero .skeleton--cover'),
    ).not.toBeNull();
    cleanup();

    render(<StatsSkeleton />);
    expect(screen.getByRole('status').querySelectorAll('.stat-tiles > li')).toHaveLength(4);
  });

  it('hides individual blocks from assistive tech and sizes them inline', () => {
    const { container } = render(<Skeleton variant="text" width="50%" height={12} />);
    const block = container.querySelector<HTMLElement>('.skeleton')!;
    expect(block).toHaveAttribute('aria-hidden', 'true');
    expect(block).toHaveClass('skeleton--text');
    expect(block.style.width).toBe('50%');
    expect(block.style.height).toBe('12px');
  });
});

describe('useStoredValue', () => {
  it('reads a validated value, writes it, and keeps every subscriber in sync', () => {
    localStorage.clear();
    const a = renderHook(() => useStoredValue('k', ['x', 'y'] as const, 'x'));
    const b = renderHook(() => useStoredValue('k', ['x', 'y'] as const, 'x'));
    expect(a.result.current[0]).toBe('x');
    act(() => a.result.current[1]('y'));
    expect(b.result.current[0]).toBe('y');
    expect(localStorage.getItem('k')).toBe('y');
    act(() => writeStoredValue('k', 'garbage'));
    expect(a.result.current[0]).toBe('x');
  });
});
