const crypto = require('crypto');
const { prisma } = require('../db');

function generatePurchaseId() {
  return `item-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

// Generates a brand-new, single-use QR token for one item/purchase. Printed
// generic - no meal/reward card attached yet, since the customer picks that
// after scanning, not staff at print time. The token carries no reward
// data, just a secure random identifier.
async function generateQrCode({ purchaseId } = {}) {
  if (purchaseId) {
    const existing = await prisma.purchaseQrCode.findUnique({ where: { purchaseId } });
    if (existing) {
      return existing; // idempotent: never mint a second code for the same purchase
    }
  }

  const token = crypto.randomUUID();

  return prisma.purchaseQrCode.create({
    data: { purchaseId: purchaseId || generatePurchaseId(), token, status: 'ACTIVE' },
  });
}

module.exports = { generateQrCode };
