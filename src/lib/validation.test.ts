import { describe, it, expect } from 'vitest'
import {
  CreateBookSchema,
  UpdateBookSchema,
  CreateLibrarySchema,
  CreateShelfSchema,
  CreateLendingSchema,
  UpdateUserSchema,
} from './validation'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'
const currentYear = new Date().getFullYear()

describe('CreateBookSchema', () => {
  it('accepts valid input with all fields', () => {
    const input = {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      isbn: '978-0-7432-7356-5',
      coverUrl: 'https://example.com/cover.jpg',
      category: 'Fiction',
      year: 1925,
      publisher: 'Scribner',
      language: 'English',
      rating: 4,
      comment: 'A classic.',
      readStatus: 'READ' as const,
      shelfId: validUUID,
      tags: ['classic', 'fiction'],
    }

    const result = CreateBookSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('accepts minimal valid input (only title)', () => {
    const result = CreateBookSchema.safeParse({ title: 'A Book' })
    expect(result.success).toBe(true)
  })

  // Title validation
  it('rejects empty title', () => {
    const result = CreateBookSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Title is required')
    }
  })

  it('rejects missing title', () => {
    const result = CreateBookSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects title longer than 500 chars', () => {
    const result = CreateBookSchema.safeParse({ title: 'a'.repeat(501) })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Title too long')
    }
  })

  it('accepts title exactly 500 chars', () => {
    const result = CreateBookSchema.safeParse({ title: 'a'.repeat(500) })
    expect(result.success).toBe(true)
  })

  // Author validation
  it('rejects author longer than 200 chars', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      author: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Author name too long')
    }
  })

  it('accepts author exactly 200 chars', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      author: 'a'.repeat(200),
    })
    expect(result.success).toBe(true)
  })

  // ISBN validation
  it('accepts valid 10-digit ISBN', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '0471958697',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid 13-digit ISBN', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '9780471958697',
    })
    expect(result.success).toBe(true)
  })

  it('strips hyphens from ISBN before validation', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '978-0-471-95869-7',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isbn).toBe('9780471958697')
    }
  })

  it('strips spaces from ISBN before validation', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '978 0 471 95869 7',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isbn).toBe('9780471958697')
    }
  })

  it('rejects invalid ISBN format', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '12345',
    })
    expect(result.success).toBe(false)
  })

  it('accepts ISBN-10 ending with X', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '047195869X',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty ISBN string', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      isbn: '',
    })
    expect(result.success).toBe(true)
  })

  // Year validation
  it('transforms string year to number', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      year: '2020',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.year).toBe(2020)
    }
  })

  it('accepts numeric year within range', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      year: 2020,
    })
    expect(result.success).toBe(true)
  })

  it('rejects numeric year below 1000', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      year: 999,
    })
    expect(result.success).toBe(false)
  })

  it('rejects numeric year above current year + 1', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      year: currentYear + 2,
    })
    expect(result.success).toBe(false)
  })

  it('accepts numeric year equal to current year + 1', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      year: currentYear + 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts year equal to 1000', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      year: 1000,
    })
    expect(result.success).toBe(true)
  })

  // Rating validation
  it('transforms string rating to number', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      rating: '3',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rating).toBe(3)
    }
  })

  it('clamps string rating above 5 to 5', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      rating: '10',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rating).toBe(5)
    }
  })

  it('clamps string rating below 0 to 0', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      rating: '-3',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rating).toBe(0)
    }
  })

  it('transforms empty string rating to 0', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      rating: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rating).toBe(0)
    }
  })

  it('accepts numeric rating in range 0-5', () => {
    for (let i = 0; i <= 5; i++) {
      const result = CreateBookSchema.safeParse({
        title: 'Book',
        rating: i,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects numeric rating above 5', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      rating: 6,
    })
    expect(result.success).toBe(false)
  })

  it('rejects numeric rating below 0', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      rating: -1,
    })
    expect(result.success).toBe(false)
  })

  // Cover URL validation
  it('accepts valid URL for coverUrl', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      coverUrl: 'https://example.com/image.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty string for coverUrl', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      coverUrl: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid URL for coverUrl', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      coverUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  // Tags validation
  it('accepts up to 20 tags', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      tags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 20 tags', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Too many tags')
    }
  })

  // Shelf ID validation
  it('accepts valid UUID for shelfId', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      shelfId: validUUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID shelfId', () => {
    const result = CreateBookSchema.safeParse({
      title: 'Book',
      shelfId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid shelf ID')
    }
  })
})

describe('UpdateBookSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateBookSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial fields', () => {
    const result = UpdateBookSchema.safeParse({ title: 'Updated Title' })
    expect(result.success).toBe(true)
  })

  it('title is optional (not required)', () => {
    const result = UpdateBookSchema.safeParse({ author: 'Someone' })
    expect(result.success).toBe(true)
  })

  it('still validates field constraints when provided', () => {
    const result = UpdateBookSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })
})

describe('CreateLibrarySchema', () => {
  it('accepts valid input', () => {
    const result = CreateLibrarySchema.safeParse({
      name: 'My Library',
      location: 'Living Room',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateLibrarySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Library name is required')
    }
  })

  it('rejects missing name', () => {
    const result = CreateLibrarySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    const result = CreateLibrarySchema.safeParse({
      name: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Library name too long')
    }
  })

  it('accepts name exactly 100 chars', () => {
    const result = CreateLibrarySchema.safeParse({
      name: 'a'.repeat(100),
    })
    expect(result.success).toBe(true)
  })

  it('location is optional', () => {
    const result = CreateLibrarySchema.safeParse({ name: 'Lib' })
    expect(result.success).toBe(true)
  })

  it('rejects location longer than 200 chars', () => {
    const result = CreateLibrarySchema.safeParse({
      name: 'Lib',
      location: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Location too long')
    }
  })
})

describe('CreateShelfSchema', () => {
  it('accepts valid input', () => {
    const result = CreateShelfSchema.safeParse({
      name: 'Top Shelf',
      libraryId: validUUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateShelfSchema.safeParse({
      name: '',
      libraryId: validUUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Shelf name is required')
    }
  })

  it('rejects name longer than 100 chars', () => {
    const result = CreateShelfSchema.safeParse({
      name: 'a'.repeat(101),
      libraryId: validUUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Shelf name too long')
    }
  })

  it('rejects non-UUID libraryId', () => {
    const result = CreateShelfSchema.safeParse({
      name: 'Shelf',
      libraryId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid library ID')
    }
  })

  it('requires libraryId', () => {
    const result = CreateShelfSchema.safeParse({ name: 'Shelf' })
    expect(result.success).toBe(false)
  })
})

describe('CreateLendingSchema', () => {
  it('accepts valid input', () => {
    const result = CreateLendingSchema.safeParse({
      bookId: validUUID,
      borrowerName: 'John Doe',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID bookId', () => {
    const result = CreateLendingSchema.safeParse({
      bookId: 'not-a-uuid',
      borrowerName: 'John',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid book ID')
    }
  })

  it('rejects empty borrowerName', () => {
    const result = CreateLendingSchema.safeParse({
      bookId: validUUID,
      borrowerName: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Borrower name is required')
    }
  })

  it('rejects borrowerName longer than 100 chars', () => {
    const result = CreateLendingSchema.safeParse({
      bookId: validUUID,
      borrowerName: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Borrower name too long')
    }
  })

  it('strips < and > chars from borrowerName', () => {
    const result = CreateLendingSchema.safeParse({
      bookId: validUUID,
      borrowerName: '<script>alert("xss")</script>',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // All < and > characters are stripped
      expect(result.data.borrowerName).toBe('scriptalert("xss")/script')
    }
  })

  it('strips angle brackets from borrowerName (XSS prevention)', () => {
    const result = CreateLendingSchema.safeParse({
      bookId: validUUID,
      borrowerName: 'John <> Doe',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.borrowerName).toBe('John  Doe')
    }
  })
})

describe('UpdateUserSchema', () => {
  it('accepts valid tier', () => {
    for (const tier of ['FREE', 'PRO', 'UNLIMITED']) {
      const result = UpdateUserSchema.safeParse({ tier })
      expect(result.success).toBe(true)
    }
  })

  it('accepts valid role', () => {
    for (const role of ['USER', 'ADMIN']) {
      const result = UpdateUserSchema.safeParse({ role })
      expect(result.success).toBe(true)
    }
  })

  it('accepts both tier and role', () => {
    const result = UpdateUserSchema.safeParse({
      tier: 'PRO',
      role: 'ADMIN',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (both optional)', () => {
    const result = UpdateUserSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid tier', () => {
    const result = UpdateUserSchema.safeParse({ tier: 'PREMIUM' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = UpdateUserSchema.safeParse({ role: 'SUPERADMIN' })
    expect(result.success).toBe(false)
  })
})
