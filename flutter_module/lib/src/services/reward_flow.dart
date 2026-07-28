import 'package:flutter/material.dart';

import '../models/scan_result.dart';
import '../screens/choose_meal_screen.dart';
import '../screens/reward_progress_screen.dart';
import 'reward_api_client.dart';
import 'reward_config.dart';

/// Step 1: called right after a QR is scanned/decoded (in-app camera or OS
/// deep link - both end up with nothing more than a raw token). Confirms
/// the code is still usable, then lets the customer pick which reward card
/// it counts toward - that choice belongs to the customer, not the printed
/// label.
Future<void> handleScannedToken(
  BuildContext context,
  RewardConfig config,
  String token,
) async {
  final client = RewardApiClient(config);
  final result = await client.checkToken(token);
  if (!context.mounted) return;

  if (result.outcome == ScanOutcome.valid) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ChooseMealScreen(config: config, token: token)),
    );
    return;
  }

  await _showMessage(context, result.message);
}

/// Step 2: called once the customer picks a card in [ChooseMealScreen].
/// This is the actual atomic claim against the backend.
Future<void> redeemChosenRewardAndNavigate(
  BuildContext context,
  RewardConfig config,
  String token,
  int rewardImageId,
) async {
  final client = RewardApiClient(config);
  final result = await client.redeemQrCode(token, rewardImageId);
  if (!context.mounted) return;

  if (result.outcome == ScanOutcome.unlocked) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => RewardProgressScreen(config: config, progress: result.progress!),
      ),
    );
    return;
  }

  await _showMessage(context, result.message);
}

Future<void> _showMessage(BuildContext context, String message) {
  return showDialog<void>(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('QR Code'),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK')),
      ],
    ),
  );
}
