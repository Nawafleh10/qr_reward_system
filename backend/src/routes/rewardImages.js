const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// Lists the reward cards currently available to assign to a new QR (e.g.
// for the print-label picker: "which meal is this for?").
router.get('/', async (req, res, next) => {
  try {
    const images = await prisma.rewardImage.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    res.json({ rewardImages: images });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
