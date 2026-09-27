/**
 * One-shot asks between screens that do not own each other's state.
 *
 * Two of them exist. Settings and the library's empty states ask the app shell
 * to open the onboarding tour, which lives in the shell because it has to
 * cover whichever tab the person is on. The tour's closing CTA asks the
 * Library tab to open its add-book sheet, which is that screen's own state.
 *
 * A counter, not a boolean: asking twice in a row has to fire twice, and the
 * screen that acted on the ask clears it so coming back later does not
 * re-open anything.
 */
import { useSyncExternalStore } from 'react';

function createIntent() {
  let asked = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    ask: () => {
      asked += 1;
      emit();
    },
    clear: () => {
      if (asked === 0) return;
      asked = 0;
      emit();
    },
    get: () => asked,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const tour = createIntent();
const addBook = createIntent();

/** Re-open the first-session tour (Settings, an empty state). */
export const openTour = tour.ask;
/** Called by the shell once it has opened the tour. */
export const clearTourRequest = tour.clear;

/** Open the Library tab's add-book sheet (the tour's closing CTA). */
export const requestAddBook = addBook.ask;
/** Called by the Library tab once the sheet is open. */
export const clearAddBookRequest = addBook.clear;

/** How many times the tour has been asked for; `0` = nobody asked. */
export function useTourRequest(): number {
  return useSyncExternalStore(tour.subscribe, tour.get, tour.get);
}

/** How many times "add a book" has been asked for; `0` = nobody asked. */
export function useAddBookRequest(): number {
  return useSyncExternalStore(addBook.subscribe, addBook.get, addBook.get);
}

/** Forget both asks (tests, sign-out). */
export function clearIntents() {
  tour.clear();
  addBook.clear();
}
