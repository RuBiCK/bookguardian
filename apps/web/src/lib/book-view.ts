/** How a book list is drawn: cover grid or one row per book. Remembered per device. */
export const BOOK_VIEWS = ['grid', 'list'] as const;
export type BookView = (typeof BOOK_VIEWS)[number];
export const BOOK_VIEW_KEY = 'bookguardian.bookView';
