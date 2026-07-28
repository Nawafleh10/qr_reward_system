require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Example seed data using the 4 reward card designs you provided - one card
// per meal type. All 4 are `isActive` (available to pick when printing a
// new QR) at once, since they're different meals sold in parallel, not
// sequential campaigns. Rename `name` to match your actual meal names, and
// add more rows any time a new meal needs its own card.
const REWARD_IMAGES = [
  { name: 'Meal 1', imageUrl: '/reward-images/reward-1.jpeg', totalSections: 10, rows: 2, cols: 5, isActive: true },
  { name: 'Meal 2', imageUrl: '/reward-images/reward-2.jpeg', totalSections: 10, rows: 2, cols: 5, isActive: true },
  { name: 'Meal 3', imageUrl: '/reward-images/reward-3.jpeg', totalSections: 12, rows: 3, cols: 4, isActive: true },
  { name: 'Meal 4', imageUrl: '/reward-images/reward-4.jpeg', totalSections: 12, rows: 3, cols: 4, isActive: true },
];

async function main() {
  for (const image of REWARD_IMAGES) {
    await prisma.rewardImage.upsert({
      where: { imageUrl: image.imageUrl },
      update: { isActive: image.isActive },
      create: image,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
