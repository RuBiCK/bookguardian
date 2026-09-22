# Using Bookguardian

This guide is for the person using the app: how your books are organised, the
four ways to add one, and how lending works. It assumes Bookguardian is
already running — [`README.md`](../README.md) covers installing, deploying and
configuring it.

Everything here is a phone-first screen. It works on a desktop browser too,
but the layout is built for one thumb on a 390 px-wide screen, and the app can
be installed to your home screen as a PWA (the Library tab offers it).

## Getting started

**Sign in with Google.** There is no password and no sign-up form: the first
time you sign in, your account is created from your Google email address. An
email address is one account — signing in again from another phone or browser
always lands in the same library. The details of the flow, and what a
self-hoster can restrict, are in [Authentication](auth.md).

**You already have somewhere to put a book.** Every new account is created
with a library called **My Library** holding one shelf called **Default**, so
you never have to set anything up before adding your first book. Both are
ordinary rows you can rename, and they are created only when you have no
library at all — signing in again never adds a second copy.

**The five tabs** along the bottom are the whole app:

| Tab          | What it is for                                                       |
| ------------ | -------------------------------------------------------------------- |
| **Library**  | Your libraries, a search box across every book, and the **+** button |
| **Scan**     | Adding a book with the camera: ISBN barcode or cover photo           |
| **Lending**  | Every book that is currently out, grouped by borrower                |
| **Stats**    | How big your library is and what is in it                            |
| **Settings** | Your account, appearance, and cover maintenance                      |

The interface is available in English and Spanish and follows your browser's
language. The switcher is in the footer of the public page you see before
signing in; the choice is remembered for next time.

## Libraries and shelves

### What the two levels mean

A **library** is a place you keep books — a home, an office, a summer house.
It has a name and an optional location (the placeholder suggests "Living room,
office…"), and it is shown with its shelf and book counts.

A **shelf** is a subdivision inside one library, in an order you control.
Every book sits on exactly one shelf, and the shelf is what tells you where
the physical book actually is. Shelves keep the order you give them
everywhere they are listed, including the pickers.

The full field list and how the tables relate is in
[the data model](data-model.md).

### Creating and renaming

- **New library** — the button in the Library tab header. Name is required,
  location is optional.
- **New shelf** — open the library, tap **Manage**, then **New shelf**. New
  shelves are appended at the end.
- **Renaming** — **Manage** shows a pencil next to the library itself and next
  to every shelf. Renaming a shelf never touches the books on it.

### Reordering shelves

In **Manage** mode each shelf row has up and down arrows: one tap swaps it
with its neighbour and the new order is saved immediately. That order is what
the shelf list, the library screen and every shelf picker use.

### Moving a book to another shelf

From the book page, the **Location** row has a **Move** button. From a list
you can get there without opening the book: long-press a cover in the grid (or
use the **More actions** button on a list row) and choose **Move**.

The picker groups shelves by library and each option reads `Library › Shelf`,
so two shelves both called "Default" are still tellable apart. A book can move
between libraries this way — there is nothing else to do.

### Deleting, and the questions it asks

Deleting a container never silently strands a book, so three rules apply. The
app enforces them in the confirmation sheet and the API enforces them again,
so nothing gets through the back door.

- **A library always keeps at least one shelf.** Deleting a library's only
  shelf is refused with _"A library needs at least one shelf."_ and the delete
  button stays disabled. Rename it instead, or add the replacement shelf
  first.
- **You always keep at least one library.** Deleting your only library is
  refused with _"You need at least one library."_ Without it there would be
  nowhere for the next book to land.
- **A container holding books needs a destination.** Deleting a shelf or a
  library that still holds books shows _"“Name” still holds N books. Move them
  to another shelf first."_ together with a **Move its books to** picker; the
  delete button only becomes available once you have picked a shelf. The
  destination has to be a shelf that survives the delete, so the shelves that
  are about to disappear are left out of the list. The books are re-shelved
  first and the container is removed afterwards, in a single step — if
  anything fails, nothing is deleted.

Deleting a **book** is different: it asks once (_"Delete “Title”?"_) and then
removes the book and its whole lending history. There is no undo.

### Your library is yours

Every library, shelf, book and lending belongs to your account and is filtered
by it on every single request, reads included. Another account's shelf id
behaves exactly like one that does not exist. Sharing a library read-only is
planned and the database already has a place for it, but no screen and no API
route grants access yet, so today nobody else can see your books. See
[Isolation between users](auth.md#isolation-between-users).

## Adding a book

There are four ways in, and they all end with the book on a shelf. Pick the
one that matches what you have in your hands:

| You have…                   | Use                                                       |
| --------------------------- | --------------------------------------------------------- |
| Just a title in your head   | [The form](#1-by-hand)                                    |
| The book, with a barcode    | [Scan → ISBN barcode](#2-scan-the-isbn-barcode)           |
| The book, without a barcode | [Scan → Book cover](#3-photograph-the-cover)              |
| A few details but no ISBN   | [Search online](#4-search-online-from-a-half-filled-form) |

Whichever you use, the shelf is decided for you. The **+** button on a shelf
screen adds to that shelf, and on a library screen to that library's first
shelf; everywhere else — the Library tab, the Scan tab — the book lands on the
shelf you last added to, which on a brand-new account is the Default shelf of
My Library. The add sheet always shows which shelf that is, with **Change**
next to it.

### 1. By hand

Tap **+** on the Library tab (or inside any shelf), type a **title** and tap
**Save**. Title is the only required field; everything else can come later.

**More details** unfolds the rest of the form: ISBN, subtitle, publisher, year
and pages, language, categories, a cover URL, description and your own private
notes. Rating, reading status and the date you finished it are not asked for
here — they live on the book page, where you will be when you actually want to
set them.

The save is optimistic: the sheet closes and the book appears immediately, and
a toast tells you which shelf it went to.

### 2. Scan the ISBN barcode

The **Scan** tab opens in **ISBN barcode** mode and starts the rear camera.
Point it at the barcode on the back of the book; only book barcodes
(EAN-13 starting with 978 or 979) are read, so the rest of the packaging is
ignored. As soon as one is recognised the scanner pauses and the lookup runs.

If the live camera is not available, the other two paths on the same screen
still work:

- **Choose a photo** — decodes the barcode from a photo or a screenshot.
- **Or type the ISBN** — type or paste the number and tap **Look up**.

The camera needs a secure context (HTTPS or localhost). Reaching the app over
plain HTTP on a LAN IP is not one, so the scanner reports _"No camera
available here. Pick a photo of the barcode instead."_ — the README explains
the two supported ways around it, a
[Cloudflare tunnel](../README.md#run-with-docker) or the bundled
[HTTPS front for your LAN](../README.md#test-on-your-phone-over-the-lan). A
camera you simply denied permission to says so instead, and can be re-allowed
in your browser settings.

Either way the result is one bottom sheet showing what was found, with
**Add to <shelf>** as the primary button — one tap and you are done — or
**Edit details** to review everything in the normal form first. If no
catalogue knows the ISBN, the sheet offers **Add it manually** with the ISBN
already filled in.

### 3. Photograph the cover

Books older than barcodes, or with the barcode rubbed off, go through **Scan →
Book cover**. Take or pick a photo of the front cover and the text is read on
your device — nothing is uploaded — and turned into searches.

Three things can happen:

- The photo contains a printed ISBN (back cover, copyright page): that wins,
  and you get the same result sheet as a barcode scan.
- The text produced matches: up to five candidates are shown as _"Is it one of
  these?"_ — tap the right one to reach the result sheet.
- Nothing readable, or no match: the notice offers **Try again** and
  **Add it manually**, the latter pre-filled with the best guess at the title.

The photo you took travels with the result, and becomes the book's cover if
the catalogues have no image for it.

Text recognition downloads its engine from the internet the first time you use
it and caches it in the browser afterwards, so the very first cover scan needs
a connection.

### 4. Search online from a half-filled form

When you have some details but no ISBN, let the form do the typing. Fill in
whatever you know — title, authors, ISBN, publisher, year; any single one is
enough — and tap **Search online** (or press Enter from one of those fields).
A sheet lists up to ten matches with cover, title, authors, publisher, year,
ISBN and which catalogue they came from.

Tapping a result fills the form without throwing away your work:

- Fields you left empty take the online value.
- Fields you typed are kept. When the result disagrees, a **Use online value:
  …** chip appears under the field — tap it to take theirs, ignore it to keep
  yours.
- The ISBN always comes from the result, because it identifies the edition
  rather than describing it.

Leaving the sheet or editing a field cancels a search that is still running,
and nothing is remembered between searches. This button only exists while
adding a book, not while editing one.

### Where the details and the cover come from

Book details come from **Open Library** first, with **Google Books** as a
fallback when Open Library has no record. Once an ISBN has been looked up, the
result is kept in a catalogue shared by the whole instance, so the same ISBN is
never fetched twice and a book you scan a second time appears instantly — see
[ADR 0003](adr/0003-shared-isbn-catalogue.md).

Covers arrive on their own. Saving a book with an ISBN and no cover of your
own starts a background search; the book is saved straight away and the page
says _"Looking for a cover…"_ until it resolves. Until then — and for good if
nothing is found — you get a coloured card with the title and author on it
instead of an empty box. Tapping the cover on a book page lets you take or
pick your own photo, which replaces whatever the catalogue offered until you
choose **Use the catalogue cover** again. The details are in
[ADR 0004](adr/0004-cover-assets.md).

## Lending

### Lending a book

Open the book and tap **Lend** in the Lending section. From a list you can
also swipe a row left, or long-press a cover, and pick **Lend**.

The sheet asks for three things:

- **Who has it?** — the only required field. Names you have lent to before
  appear as one-tap chips as you type, and picking one brings their contact
  along.
- **Contact or note** (optional) — free text: a phone number, an email,
  "from work".
- **Due back** (optional) — a calendar day; the picker starts at today and
  does not offer earlier days.

There is no "lent on" field: the lending is stamped with the moment you tap
**Lend**, and the sheet closes immediately.

### One borrower at a time

A book can be out to at most one person. If the same book is somehow lent
twice — a double tap, or a second device — the second attempt is refused and
you see _"This book is already lent out."_ The check and the insert happen
together on the server, so the race cannot produce two open lendings.

### Getting it back

Tap **Returned** — on the book page, on the Lending tab, or by swiping the row
of a book that is out. The lending closes with the current time and moves into
that book's **Lending history**, which lists every past borrower with the dates
the book was away. A lending that is already closed cannot be closed again,
and a return can never be recorded as happening before the lending itself.

### Overdue

A lending is **overdue** when it is still open and its due day is already past.
The due day itself is not overdue — a book due today is simply due today — and
"past" is judged against the server's calendar day, so run it in the timezone
of the people using it.

Books with no due date are never overdue; they are just out.

### Where you see what is out

- The **Lending** tab is the full picture: a summary line ("4 books out · 1
  overdue"), then one section per borrower with their contact, each book
  showing how long it has been out and either its due date or an **Overdue**
  badge. Every row has a **Returned** button, and tapping the book opens it.
- Lists mark a book that is out with a **Lent** badge on its cover or row.
- The **book page** shows who has it right now, with their contact, when it
  went out, and the full history underneath.
- The **Stats** tab counts lent-out books in its hero row and links to the
  Lending tab.

## Where to go next

- [`README.md`](../README.md) — running, deploying and configuring
  Bookguardian, plus the complete API reference.
- [Data model](data-model.md) — every entity and field, with the ER diagram.
- [Authentication](auth.md) — sign-in, sessions, deleting your account and how
  accounts are kept apart.
- [Visual language](design.md) — the design rules the screens follow.
