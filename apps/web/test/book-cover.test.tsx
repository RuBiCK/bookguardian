import { en } from '@bookguardian/shared/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookCover } from '../src/components/BookCover';
import {
  contrastRatio,
  hashString,
  placeholderColor,
  PLACEHOLDER_PALETTE,
  PLACEHOLDER_TEXT,
} from '../src/lib/cover-placeholder';

const SHA = 'b'.repeat(64);
const book = { title: 'The Left Hand of Darkness', authors: ['Ursula K. Le Guin'] };

describe('placeholder colours', () => {
  it('derive from the title, stably and case-insensitively', () => {
    expect(placeholderColor('Dune')).toBe(placeholderColor('dune '));
    expect(hashString('Dune')).toBe(hashString('Dune'));
    expect(PLACEHOLDER_PALETTE).toContain(placeholderColor('Dune'));
    // Different titles spread across the palette.
    const used = new Set(
      ['Dune', 'Emma', 'Neuromancer', 'Ulysses', 'Beloved', 'Middlemarch', 'Persuasion', 'It'].map(
        placeholderColor,
      ),
    );
    expect(used.size).toBeGreaterThan(3);
  });

  it('keep white text at WCAG AA contrast (≥ 4.5:1) on every colour, whatever the theme', () => {
    for (const background of PLACEHOLDER_PALETTE) {
      expect(contrastRatio(background, PLACEHOLDER_TEXT), background).toBeGreaterThanOrEqual(4.5);
    }
    // And the card itself stands out from both page backgrounds.
    for (const background of PLACEHOLDER_PALETTE) {
      expect(contrastRatio(background, '#f7f4ee'), `${background} on light`).toBeGreaterThan(3);
      expect(contrastRatio(background, '#15130f'), `${background} on dark`).toBeGreaterThan(1.2);
    }
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
});

describe('BookCover', () => {
  it('draws a title/author card when there is no image', () => {
    render(<BookCover book={book} />);
    const cover = screen.getByTestId('book-cover');
    expect(cover).toHaveAttribute('data-state', 'placeholder');
    expect(cover.querySelector('img')).toBeNull();
    expect(cover).toHaveTextContent('The Left Hand of Darkness');
    expect(cover).toHaveTextContent('Ursula K. Le Guin');
    const card = cover.querySelector<HTMLElement>('.cover__placeholder')!;
    expect(card.style.background).not.toBe('');
    expect(card).toHaveAttribute('aria-hidden', 'true');

    render(<BookCover book={{ title: 'Anon', authors: [] }} />);
    expect(screen.getAllByTestId('book-cover')[1]).toHaveTextContent(en.books.unknownAuthor);
  });

  it('renders the coloured card alone when compact', () => {
    render(<BookCover book={book} compact />);
    const cover = screen.getByTestId('book-cover');
    expect(cover).toHaveAttribute('data-state', 'placeholder');
    expect(cover).toHaveTextContent('');
    expect(cover.querySelector<HTMLElement>('.cover__placeholder')!.style.background).not.toBe('');
  });

  it('marks the card as pending while the API is still looking', () => {
    render(<BookCover book={{ ...book, coverAssetId: null, coverPending: true }} />);
    expect(screen.getByTestId('book-cover')).toHaveAttribute('data-state', 'pending');
  });

  it('loads a stored cover lazily with a thumb/full srcset and a skeleton until decoded', () => {
    render(<BookCover book={{ ...book, coverAssetId: SHA }} sizes="120px" />);
    const cover = screen.getByTestId('book-cover');
    expect(cover).toHaveAttribute('data-state', 'loading');
    const img = cover.querySelector('img')!;
    expect(img).toHaveAttribute('src', `/api/covers/${SHA}-thumb.webp`);
    expect(img).toHaveAttribute(
      'srcset',
      `/api/covers/${SHA}-thumb.webp 133w, /api/covers/${SHA}.webp 400w`,
    );
    expect(img).toHaveAttribute('sizes', '120px');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('alt', '');
    fireEvent.load(img);
    expect(cover).toHaveAttribute('data-state', 'loaded');
  });

  it('shows an external image for catalogue drafts and falls back to the card if it fails', () => {
    render(<BookCover book={book} src="https://covers.example.com/x.jpg" />);
    const cover = screen.getByTestId('book-cover');
    const img = cover.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://covers.example.com/x.jpg');
    expect(img).not.toHaveAttribute('srcset');
    fireEvent.error(img);
    expect(cover).toHaveAttribute('data-state', 'placeholder');
    expect(cover).toHaveTextContent('The Left Hand of Darkness');
  });
});
