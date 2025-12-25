import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed file is no longer needed for multi-user authentication system
  // Default libraries and shelves are automatically created when users
  // add their first book (see src/app/api/books/route.ts)
  console.log('Seed: Multi-user system - no default data needed')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
