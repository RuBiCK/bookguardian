/**
 * Security configuration smoke tests
 * Verify that security-related configurations are present and correct.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')

describe('Security configuration smoke tests', () => {
  describe('next.config.ts security headers', () => {
    const configPath = path.join(projectRoot, 'next.config.ts')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(configPath, 'utf-8')
    })

    it('contains X-Frame-Options header', () => {
      expect(content).toContain('X-Frame-Options')
    })

    it('contains X-Content-Type-Options header', () => {
      expect(content).toContain('X-Content-Type-Options')
    })

    it('contains Strict-Transport-Security header', () => {
      expect(content).toContain('Strict-Transport-Security')
    })

    it('contains Content-Security-Policy header', () => {
      expect(content).toContain('Content-Security-Policy')
    })

    it('contains Referrer-Policy header', () => {
      expect(content).toContain('Referrer-Policy')
    })

    it('contains Permissions-Policy header', () => {
      expect(content).toContain('Permissions-Policy')
    })
  })

  describe('src/auth.ts session configuration', () => {
    const authPath = path.join(projectRoot, 'src/auth.ts')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(authPath, 'utf-8')
    })

    it('contains maxAge session config', () => {
      expect(content).toContain('maxAge')
    })

    it('contains updateAge session config', () => {
      expect(content).toContain('updateAge')
    })
  })

  describe('docker-compose.yml environment variable substitution', () => {
    const dockerComposePath = path.join(projectRoot, 'docker-compose.yml')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(dockerComposePath, 'utf-8')
    })

    it('uses env var substitution for POSTGRES_USER', () => {
      expect(content).toContain('${POSTGRES_USER:-')
    })

    it('uses env var substitution for POSTGRES_PASSWORD', () => {
      expect(content).toContain('${POSTGRES_PASSWORD:-')
    })
  })
})
