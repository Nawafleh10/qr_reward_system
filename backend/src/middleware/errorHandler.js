const { RewardError } = require('../services/rewardService');

// Central error handler so every route can just throw and let this decide the HTTP response.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof RewardError) {
    const status = err.code === 'QR_NOT_FOUND' ? 404 : err.code === 'QR_ALREADY_USED' ? 409 : 400;
    return res.status(status).json({ error: err.code, message: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' });
}

module.exports = { errorHandler };
