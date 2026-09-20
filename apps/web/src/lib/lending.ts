import type { Borrower, LendingWithBook } from '@bookguardian/shared';

/** How many previous borrowers to offer as one-tap suggestions. */
export const SUGGESTION_LIMIT = 6;

/**
 * Borrowers matching what was typed (case-insensitive substring), most
 * recent first; everyone when the field is empty. An exact match is dropped
 * — the name is already in the box.
 */
export function suggestBorrowers(borrowers: readonly Borrower[], typed: string): Borrower[] {
  const needle = typed.trim().toLocaleLowerCase();
  const matches = needle
    ? borrowers.filter((b) => b.name.toLocaleLowerCase().includes(needle))
    : borrowers;
  return matches.filter((b) => b.name.toLocaleLowerCase() !== needle).slice(0, SUGGESTION_LIMIT);
}

export interface BorrowerGroup {
  name: string;
  contact: string | null;
  items: LendingWithBook[];
  overdue: number;
}

/**
 * Group active lendings by borrower (case-insensitive). Borrowers with an
 * overdue book come first, then the ones lent to most recently; inside a
 * group the newest lending is first (the API already orders that way).
 */
export function groupByBorrower(lendings: readonly LendingWithBook[]): BorrowerGroup[] {
  const groups = new Map<string, BorrowerGroup>();
  for (const lending of lendings) {
    const key = lending.borrowerName.toLocaleLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { name: lending.borrowerName, contact: null, items: [], overdue: 0 };
      groups.set(key, group);
    }
    group.items.push(lending);
    group.contact ??= lending.borrowerContact;
    if (lending.overdue) group.overdue += 1;
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.overdue > 0) - Number(a.overdue > 0) ||
      b.items[0]!.lentAt.localeCompare(a.items[0]!.lentAt),
  );
}
