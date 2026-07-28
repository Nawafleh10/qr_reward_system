const express = require('express');
const { getProgressListForCustomer } = require('../services/rewardService');

const router = express.Router();

// Read-only: every reward card this customer has any progress on - one
// entry per meal type they've bought at least once.
router.get('/:customerId', async (req, res, next) => {
  try {
    const progress = await getProgressListForCustomer(req.params.customerId);
    res.json({ progress });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
