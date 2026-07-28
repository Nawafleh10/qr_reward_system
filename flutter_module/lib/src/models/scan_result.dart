import 'reward_progress.dart';

enum ScanOutcome { valid, unlocked, alreadyUsed, notFound, error }

class ScanResult {
  final ScanOutcome outcome;
  final String message;
  final RewardProgress? progress;

  const ScanResult({required this.outcome, required this.message, this.progress});
}
