const express = require('express');
const { generateQrCode } = require('../services/qrTokenService');

const router = express.Router();

// Called by the purchase/kitchen flow right after an item is ready to hand
// over - one click, no typing, no meal selection. purchaseId is optional:
// pass it if your POS already has an order id, otherwise one is generated
// automatically.
router.post('/qrcode', async (req, res, next) => {
  try {
    const { purchaseId } = req.body || {};
    const qrCode = await generateQrCode({ purchaseId });
    res.status(201).json({
      purchaseId: qrCode.purchaseId,
      token: qrCode.token,
      status: qrCode.status,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
