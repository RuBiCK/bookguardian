/**
 * Script para limpiar todos los datos de desarrollo
 * Ejecutar: npx tsx scripts/clean-db.ts
 *
 * ⚠️ PELIGRO: Esto eliminará TODOS los datos de la base de datos
 */
import { PrismaClient } from '@prisma/client'
import readline from 'readline'

const prisma = new PrismaClient()

async function askConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(
      '⚠️  This will DELETE ALL data from the database. Are you sure? (yes/no): ',
      (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes')
      }
    )
  })
}

async function cleanDatabase() {
  console.log('🗑️  Database Cleanup Script')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const confirmed = await askConfirmation()

  if (!confirmed) {
    console.log('❌ Cleanup cancelled')
    return
  }

  try {
    console.log('\n🔄 Starting cleanup...\n')

    // Delete in correct order due to foreign keys
    console.log('Deleting Lendings...')
    await prisma.lending.deleteMany()

    console.log('Deleting Books (will also delete _BookToTag relations)...')
    await prisma.book.deleteMany()

    console.log('Deleting Tags...')
    await prisma.tag.deleteMany()

    console.log('Deleting Shelves...')
    await prisma.shelf.deleteMany()

    console.log('Deleting Libraries...')
    await prisma.library.deleteMany()

    console.log('Deleting Sessions...')
    await prisma.session.deleteMany()

    console.log('Deleting Accounts...')
    await prisma.account.deleteMany()

    console.log('Deleting Users...')
    await prisma.user.deleteMany()

    console.log('\n✨ Database cleaned successfully!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('All data has been removed.')
  } catch (error) {
    console.error('\n❌ Error cleaning database:', error)
    throw error
  }
}

cleanDatabase()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
