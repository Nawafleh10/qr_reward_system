const express = require('express');
const { checkQrCode, redeemQrCode } = require('../services/rewardService');

const router = express.Router();

// Step 1: called right after the app scans/decodes a QR, before showing the
// "which meal is this for?" picker. Read-only - does not consume the code.
router.get('/:token', async (req, res, next) => {
  try {
    const result = await checkQrCode(req.params.token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Step 2: the ONLY endpoint that can move a customer's progress forward.
// Called once the customer has picked a meal. customerId is the app's own
// authenticated user (see RewardConfig.getCustomerId on the Flutter side);
// rewardImageId is the customer's choice. Neither can grant extra sections
// or claim a code more than once - see redeemQrCode's atomic update.
router.post('/', async (req, res, next) => {
  try {
    const { token, customerId, rewardImageId } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'MISSING_TOKEN', message: 'token is required.' });
    }
    if (!customerId) {
      return res.status(400).json({ error: 'MISSING_CUSTOMER_ID', message: 'customerId is required.' });
    }
    if (!rewardImageId) {
      return res.status(400).json({ error: 'MISSING_REWARD_IMAGE_ID', message: 'rewardImageId is required.' });
    }

    const progress = await redeemQrCode(token, customerId, rewardImageId);
    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
