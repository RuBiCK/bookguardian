import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const defaultLibrary = await prisma.library.create({
    data: {
      name: 'Default Library',
      location: 'Home',
      shelves: {
        create: {
          name: 'Default Shelf',
        },
      },
    },
  })
  console.log({ defaultLibrary })
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
