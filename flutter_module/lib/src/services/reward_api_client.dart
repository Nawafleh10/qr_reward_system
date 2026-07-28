import 'dart:convert';
import 'package:http/http.dart' as http;

import 'reward_config.dart';
import '../models/reward_progress.dart';
import '../models/scan_result.dart';

/// Talks to the QR Reward backend. This client never decides whether a scan
/// is valid or how much progress to grant - it only reports what the
/// backend, the single source of truth, already decided.
class RewardApiClient {
  final RewardConfig config;

  RewardApiClient(this.config);

  Uri _uri(String path) => Uri.parse('${config.apiBaseUrl}$path');

  /// Step 1: confirms a just-scanned token is still usable, without
  /// consuming it. Call this before showing the "which meal is this for?"
  /// picker so an already-used code fails fast.
  Future<ScanResult> checkToken(String token) async {
    try {
      final response = await http.get(_uri('/api/scan/$token'));

      if (response.statusCode == 200) {
        return const ScanResult(outcome: ScanOutcome.valid, message: 'QR code is valid.');
      }
      if (response.statusCode == 409) {
        return const ScanResult(
          outcome: ScanOutcome.alreadyUsed,
          message: 'This QR Code has already been used.',
        );
      }
      if (response.statusCode == 404) {
        return const ScanResult(outcome: ScanOutcome.notFound, message: 'QR code not found.');
      }

      return ScanResult(outcome: ScanOutcome.error, message: 'Unexpected error (${response.statusCode}).');
    } catch (e) {
      return ScanResult(outcome: ScanOutcome.error, message: 'Could not reach the server: $e');
    }
  }

  /// Step 2: called once the customer has picked which reward card
  /// [rewardImageId] this code counts toward. This is the actual atomic
  /// claim - the code can't be spent twice even if picked concurrently.
  Future<ScanResult> redeemQrCode(String token, int rewardImageId) async {
    try {
      final response = await http.post(
        _uri('/api/scan'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'token': token,
          'customerId': config.getCustomerId(),
          'rewardImageId': rewardImageId,
        }),
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final progress = RewardProgress.fromJson(body['progress'] as Map<String, dynamic>);
        return ScanResult(outcome: ScanOutcome.unlocked, message: 'Reward section unlocked!', progress: progress);
      }

      if (response.statusCode == 409) {
        return const ScanResult(
          outcome: ScanOutcome.alreadyUsed,
          message: 'This QR Code has already been used.',
        );
      }

      if (response.statusCode == 404) {
        return const ScanResult(outcome: ScanOutcome.notFound, message: 'QR code not found.');
      }

      return ScanResult(outcome: ScanOutcome.error, message: 'Unexpected error (${response.statusCode}).');
    } catch (e) {
      return ScanResult(outcome: ScanOutcome.error, message: 'Could not reach the server: $e');
    }
  }

  /// The reward cards a customer can choose from after scanning.
  Future<List<RewardImageInfo>> getRewardImages() async {
    final response = await http.get(_uri('/api/reward-images'));
    if (response.statusCode != 200) {
      throw Exception('Failed to load reward images (${response.statusCode}).');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['rewardImages'] as List<dynamic>)
        .map((e) => RewardImageInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// A customer can hold progress on several reward cards at once (one per
  /// meal type they've chosen to collect), so this returns all of them.
  Future<List<RewardProgress>> getAllProgress(String customerId) async {
    final response = await http.get(_uri('/api/progress/$customerId'));
    if (response.statusCode != 200) {
      throw Exception('Failed to load reward progress (${response.statusCode}).');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['progress'] as List<dynamic>)
        .map((e) => RewardProgress.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
