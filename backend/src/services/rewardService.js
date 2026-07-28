const { prisma } = require('../db');
const { RewardError, QR_NOT_FOUND, QR_ALREADY_USED, INVALID_REWARD_IMAGE } = require('./rewardErrors');

// Finds (or creates) the customer's progress on one specific reward card.
// A customer can hold progress on several cards at once (one per meal type
// they've chosen to collect), so this is always scoped to a single
// rewardImageId.
async function getOrCreateProgress(customerId, rewardImageId) {
  const rewardImage = await prisma.rewardImage.findUnique({ where: { id: rewardImageId } });
  if (!rewardImage) {
    throw new RewardError(INVALID_REWARD_IMAGE, 'Unknown rewardImageId.');
  }

  let progress = await prisma.customerRewardProgress.findUnique({
    where: { customerId_rewardImageId: { customerId, rewardImageId: rewardImage.id } },
  });

  if (!progress) {
    progress = await prisma.customerRewardProgress.create({
      data: { customerId, rewardImageId: rewardImage.id, unlockedSections: '[]', completed: false },
    });
  }

  return { progress, rewardImage };
}

function serializeProgress(progress, rewardImage) {
  return {
    id: progress.id,
    customerId: progress.customerId,
    completed: progress.completed,
    unlockedSections: JSON.parse(progress.unlockedSections),
    rewardImage: {
      id: rewardImage.id,
      name: rewardImage.name,
      imageUrl: rewardImage.imageUrl,
      totalSections: rewardImage.totalSections,
      rows: rewardImage.rows,
      cols: rewardImage.cols,
    },
  };
}

// Read-only check used right after a scan, before showing the customer the
// "which meal is this for?" picker - lets the app tell them immediately if
// the code is unknown or already spent, without burning anything.
async function checkQrCode(token) {
  const qrCode = await prisma.purchaseQrCode.findUnique({ where: { token } });
  if (!qrCode) {
    throw new RewardError(QR_NOT_FOUND, 'QR code not found.');
  }
  if (qrCode.status !== 'ACTIVE') {
    throw new RewardError(QR_ALREADY_USED, 'This QR Code has already been used.');
  }
  return { valid: true };
}

// The one place that decides whether a scan is allowed and what it unlocks.
// customerId AND rewardImageId are both supplied here, at claim time - the
// customer picked the card in the app after scanning, staff never set one
// at print time. Both are stamped onto the code atomically as part of the
// same update that marks it USED, so a concurrent second claim (two people
// scanning the same sticker, or a slow double-submit) affects 0 rows and is
// rejected instead of unlocking a second section or double-assigning it.
async function redeemQrCode(token, customerId, rewardImageId) {
  const qrCode = await prisma.purchaseQrCode.findUnique({ where: { token } });
  if (!qrCode) {
    throw new RewardError(QR_NOT_FOUND, 'QR code not found.');
  }

  const rewardImage = await prisma.rewardImage.findUnique({ where: { id: Number(rewardImageId) } });
  if (!rewardImage || !rewardImage.isActive) {
    throw new RewardError(INVALID_REWARD_IMAGE, 'Unknown or inactive rewardImageId.');
  }

  const claim = await prisma.purchaseQrCode.updateMany({
    where: { token, status: 'ACTIVE' },
    data: { status: 'USED', usedAt: new Date(), customerId, rewardImageId: rewardImage.id },
  });

  if (claim.count === 0) {
    throw new RewardError(QR_ALREADY_USED, 'This QR Code has already been used.');
  }

  const { progress } = await getOrCreateProgress(customerId, rewardImage.id);

  const unlocked = new Set(JSON.parse(progress.unlockedSections));
  if (!progress.completed) {
    for (let i = 0; i < rewardImage.totalSections; i++) {
      if (!unlocked.has(i)) {
        unlocked.add(i);
        break;
      }
    }
  }

  const completed = unlocked.size >= rewardImage.totalSections;

  const updated = await prisma.customerRewardProgress.update({
    where: { id: progress.id },
    data: { unlockedSections: JSON.stringify([...unlocked]), completed },
  });

  await prisma.purchaseQrCode.update({
    where: { id: qrCode.id },
    data: { rewardProgressId: updated.id },
  });

  return serializeProgress(updated, rewardImage);
}

// All of a customer's reward cards - one entry per meal type they've
// started or finished collecting.
async function getProgressListForCustomer(customerId) {
  const rows = await prisma.customerRewardProgress.findMany({
    where: { customerId },
    include: { rewardImage: true },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => serializeProgress(row, row.rewardImage));
}

module.exports = {
  checkQrCode,
  redeemQrCode,
  getProgressListForCustomer,
  RewardError,
  QR_NOT_FOUND,
  QR_ALREADY_USED,
  INVALID_REWARD_IMAGE,
};
