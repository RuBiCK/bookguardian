/**
 * Configuration smoke tests
 * Verify that configuration files are well-formed and contain expected values.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')

describe('Configuration smoke tests', () => {
  describe('public/manifest.json', () => {
    it('is valid JSON', () => {
      const manifestPath = path.join(projectRoot, 'public/manifest.json')
      const content = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)

      expect(manifest).toBeDefined()
      expect(typeof manifest).toBe('object')
    })

    it('has all required PWA fields', () => {
      const manifestPath = path.join(projectRoot, 'public/manifest.json')
      const content = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)

      expect(manifest).toHaveProperty('name')
      expect(manifest).toHaveProperty('short_name')
      expect(manifest).toHaveProperty('icons')
      expect(manifest).toHaveProperty('start_url')
      expect(manifest).toHaveProperty('display')
      expect(manifest).toHaveProperty('theme_color')
      expect(manifest).toHaveProperty('background_color')
    })

    it('has non-empty values for required fields', () => {
      const manifestPath = path.join(projectRoot, 'public/manifest.json')
      const content = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)

      expect(manifest.name).toBeTruthy()
      expect(manifest.short_name).toBeTruthy()
      expect(manifest.start_url).toBeTruthy()
      expect(manifest.display).toBeTruthy()
      expect(manifest.theme_color).toBeTruthy()
      expect(manifest.background_color).toBeTruthy()
      expect(Array.isArray(manifest.icons)).toBe(true)
      expect(manifest.icons.length).toBeGreaterThan(0)
    })

    it('does NOT have a screenshots key', () => {
      const manifestPath = path.join(projectRoot, 'public/manifest.json')
      const content = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)

      expect(manifest).not.toHaveProperty('screenshots')
    })
  })

  describe('prisma/schema.prisma', () => {
    it('contains Book model with shelfId index', () => {
      const schemaPath = path.join(projectRoot, 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')

      // Extract the Book model section
      const bookModelMatch = content.match(/model Book \{[\s\S]*?\n\}/)
      expect(bookModelMatch).not.toBeNull()

      const bookModel = bookModelMatch![0]
      expect(bookModel).toContain('@@index([shelfId])')
    })

    it('contains Book model with readStatus index', () => {
      const schemaPath = path.join(projectRoot, 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')

      // Extract the Book model section
      const bookModelMatch = content.match(/model Book \{[\s\S]*?\n\}/)
      expect(bookModelMatch).not.toBeNull()

      const bookModel = bookModelMatch![0]
      expect(bookModel).toContain('@@index([readStatus])')
    })
  })
})
