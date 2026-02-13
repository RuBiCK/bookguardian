/**
 * Input validation schemas using Zod
 * OWASP A03:2021 - Injection prevention through strict input validation
 */
import { z } from 'zod'

// Valid ISBN: 10 or 13 digits
const isbnRegex = /^(?:\d{9}[\dX]|\d{13})$/

// Current year for validation
const currentYear = new Date().getFullYear()

// Read status enum from Prisma schema
const ReadStatus = z.enum(['WANT_TO_READ', 'READING', 'READ'])

// User tier enum from Prisma schema
const UserTier = z.enum(['FREE', 'PRO', 'UNLIMITED'])

// User role enum from Prisma schema
const UserRole = z.enum(['USER', 'ADMIN'])

/**
 * Schema for creating a new book
 */
export const CreateBookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  author: z.string().max(200, 'Author name too long').optional(),
  isbn: z.string()
    .transform(val => val?.replace(/[-\s]/g, '') || '')
    .refine(val => !val || isbnRegex.test(val), 'Invalid ISBN format')
    .optional(),
  coverUrl: z.string().url('Invalid URL').or(z.literal('')).optional(),
  category: z.string().max(100, 'Category too long').optional(),
  year: z.union([
    z.number().int().min(1000).max(currentYear + 1),
    z.string().transform(val => {
      if (!val) return undefined
      const num = parseInt(val, 10)
      if (isNaN(num)) return undefined
      return num
    })
  ]).optional(),
  publisher: z.string().max(200, 'Publisher name too long').optional(),
  language: z.string().max(50, 'Language too long').optional(),
  rating: z.union([
    z.number().int().min(0).max(5),
    z.string().transform(val => {
      if (!val) return 0
      const num = parseInt(val, 10)
      if (isNaN(num)) return 0
      return Math.max(0, Math.min(5, num))
    })
  ]).optional(),
  comment: z.string().max(5000, 'Comment too long').optional(),
  readStatus: ReadStatus.optional(),
  shelfId: z.string().uuid('Invalid shelf ID').optional(),
  tags: z.array(z.string().max(50, 'Tag too long'))
    .max(20, 'Too many tags')
    .optional(),
  metadataSource: z.string().optional(),
})

/**
 * Schema for updating an existing book (all fields optional)
 */
export const UpdateBookSchema = CreateBookSchema.partial()

/**
 * Schema for creating a library
 */
export const CreateLibrarySchema = z.object({
  name: z.string().min(1, 'Library name is required').max(100, 'Library name too long'),
  location: z.string().max(200, 'Location too long').optional(),
})

/**
 * Schema for creating a shelf
 */
export const CreateShelfSchema = z.object({
  name: z.string().min(1, 'Shelf name is required').max(100, 'Shelf name too long'),
  libraryId: z.string().uuid('Invalid library ID'),
})

/**
 * Schema for creating a lending record
 */
export const CreateLendingSchema = z.object({
  bookId: z.string().uuid('Invalid book ID'),
  borrowerName: z.string()
    .min(1, 'Borrower name is required')
    .max(100, 'Borrower name too long')
    .transform(val => val.replace(/[<>]/g, '')),
})

/**
 * Schema for updating user (admin only)
 */
export const UpdateUserSchema = z.object({
  tier: UserTier.optional(),
  role: UserRole.optional(),
})

export type CreateBookInput = z.infer<typeof CreateBookSchema>
export type UpdateBookInput = z.infer<typeof UpdateBookSchema>
export type CreateLibraryInput = z.infer<typeof CreateLibrarySchema>
export type CreateShelfInput = z.infer<typeof CreateShelfSchema>
export type CreateLendingInput = z.infer<typeof CreateLendingSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
