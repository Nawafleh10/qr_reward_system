const QR_NOT_FOUND = 'QR_NOT_FOUND';
const QR_ALREADY_USED = 'QR_ALREADY_USED';
const INVALID_REWARD_IMAGE = 'INVALID_REWARD_IMAGE';

class RewardError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = {
  RewardError,
  QR_NOT_FOUND,
  QR_ALREADY_USED,
  INVALID_REWARD_IMAGE,
};
