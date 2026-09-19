import { describe, expect, it } from 'vitest';
import {
  cleanLine,
  extractSearchQueries,
  interpretOcr,
  rankLines,
  scoreLine,
} from '../src/lib/ocr-query';

const DUNE_COVER = `
  #1 NEW YORK TIMES BESTSELLER
  |||  DUNE  |||
  ~~ FRANK HERBERT ~~
  "Science fiction's supreme masterpiece" — Arthur C. Clarke
  Now a major motion picture
  A NOVEL
  $9.99 US / $12.99 CAN
`;

describe('cleanLine', () => {
  it('strips OCR decoration and stray symbols but keeps names', () => {
    expect(cleanLine('|||  DUNE  |||')).toBe('DUNE');
    expect(cleanLine('~~ FRANK HERBERT ~~')).toBe('FRANK HERBERT');
    expect(cleanLine('“Emma” — Jane Austen')).toBe('Emma Jane Austen');
    expect(cleanLine("  --Le Petit Prince: l'édition--  ")).toBe("Le Petit Prince: l'édition");
    expect(cleanLine('***')).toBe('');
  });
});

describe('scoreLine', () => {
  it('rewards title/author-like lines and zeroes noise', () => {
    expect(scoreLine('DUNE')).toBeGreaterThan(0);
    expect(scoreLine('Frank Herbert')).toBeGreaterThan(scoreLine('the'));
    expect(scoreLine('#1 NEW YORK TIMES BESTSELLER')).toBe(0);
    expect(scoreLine('A NOVEL')).toBe(0);
    expect(scoreLine('9.99 US 12.99 CAN')).toBe(0);
    expect(scoreLine('ISBN 978-0-441-01359-3')).toBe(0);
    expect(scoreLine('by')).toBe(0);
    expect(scoreLine('a;b.c,d:e f')).toBe(0);
    expect(scoreLine('www.penguin.com')).toBe(0);
    const blurb =
      'This is a very long sentence that reads like a back cover blurb and goes on and on forever.';
    expect(scoreLine(blurb)).toBeLessThan(scoreLine('Frank Herbert'));
    expect(scoreLine('lower case words here')).toBeLessThan(scoreLine('Title Case Words Here'));
    expect(scoreLine('Mostly Capitalised words here')).toBeGreaterThan(
      scoreLine('mostly not capitalised here'),
    );
  });
});

describe('rankLines', () => {
  it('orders the cleaned lines by score and drops duplicates', () => {
    const ranked = rankLines(`${DUNE_COVER}\nDUNE\ndune`);
    expect(ranked.map((l) => l.text).slice(0, 2)).toEqual(['FRANK HERBERT', 'DUNE']);
    expect(ranked.filter((l) => l.text.toLowerCase() === 'dune')).toHaveLength(1);
    expect(ranked.every((l) => l.score > 0)).toBe(true);
    expect(rankLines('')).toEqual([]);
  });
});

describe('extractSearchQueries', () => {
  it('combines the two strongest lines first, then each alone', () => {
    expect(extractSearchQueries(DUNE_COVER)).toEqual([
      'FRANK HERBERT DUNE',
      'FRANK HERBERT',
      'DUNE',
    ]);
  });

  it('degrades gracefully with one usable line or none', () => {
    expect(extractSearchQueries('   \n Neuromancer \n $$$ ')).toEqual(['Neuromancer']);
    expect(extractSearchQueries('12 34\n$$')).toEqual([]);
    expect(extractSearchQueries(DUNE_COVER, 1)).toEqual(['FRANK HERBERT DUNE']);
  });

  it('caps very long lines', () => {
    const long = 'Word '.repeat(60).trim();
    const [query] = extractSearchQueries(`${long}\nAuthor Name`);
    expect(query!.length).toBeLessThanOrEqual(120);
  });
});

describe('interpretOcr', () => {
  it('surfaces a printed ISBN and a title guess alongside the queries', () => {
    const back = `Penguin Classics\nISBN 978-0-14-143951-8\nPride and Prejudice\nJane Austen`;
    expect(interpretOcr(back)).toEqual({
      isbn13: '9780141439518',
      queries: expect.arrayContaining(['Pride and Prejudice']),
      titleGuess: expect.stringMatching(/Pride and Prejudice|Penguin Classics|Jane Austen/),
    });
    expect(interpretOcr('')).toEqual({ isbn13: null, queries: [], titleGuess: '' });
  });
});
