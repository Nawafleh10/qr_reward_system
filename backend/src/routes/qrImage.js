const express = require('express');
const QRCode = require('qrcode');
const { prisma } = require('../db');

const router = express.Router();

// The URL a phone camera opens when it scans the printed QR. Must be an
// address the customer's phone can actually reach - localhost only works
// when testing from the same machine. Set this to your LAN IP (for local
// testing on the same WiFi) or your real deployed domain in production.
const PUBLIC_BASE_URL = process.env.APP_PUBLIC_BASE_URL || 'http://localhost:4000';

// Renders the scannable QR image for a purchase's token, e.g. to print on
// packaging. The QR encodes a plain link to the reward page
// (`${PUBLIC_BASE_URL}/reward.html?token=...`) - any phone's default camera
// app opens a regular link with zero setup, no custom app or OS
// registration required. The link still carries only the opaque token -
// never reward progress - and the backend still does all validation.
router.get('/:token/image', async (req, res, next) => {
  try {
    const { token } = req.params;
    const qrCode = await prisma.purchaseQrCode.findUnique({ where: { token } });
    if (!qrCode) {
      return res.status(404).json({ error: 'QR_NOT_FOUND', message: 'QR code not found.' });
    }

    const rewardUrl = `${PUBLIC_BASE_URL}/reward.html?token=${encodeURIComponent(token)}`;

    res.type('png');
    // High error correction + a decent quiet zone so the code still scans
    // after printing small on food packaging (grease, folds, ink bleed).
    await QRCode.toFileStream(res, rewardUrl, { width: 800, margin: 3, errorCorrectionLevel: 'H' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
