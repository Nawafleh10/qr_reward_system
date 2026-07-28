import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../services/reward_config.dart';
import '../services/reward_flow.dart';
import '../services/reward_link_parser.dart';
import 'my_rewards_screen.dart';

/// Camera-only entry point for redeeming a purchase QR code from inside the
/// app. The customer never types anything in - the scanned deep link is
/// parsed down to a token and handed to the same redeem flow the OS-level
/// deep link handler uses.
class QrScanScreen extends StatefulWidget {
  final RewardConfig config;

  const QrScanScreen({super.key, required this.config});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  bool _handled = false;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled || capture.barcodes.isEmpty) return;

    final raw = capture.barcodes.first.rawValue;
    if (raw == null) return;

    final token = parseRewardToken(
      raw,
      scheme: widget.config.deepLinkScheme,
      host: widget.config.deepLinkHost,
    );
    if (token == null) return;

    setState(() => _handled = true);
    await handleScannedToken(context, widget.config, token);
    if (mounted) setState(() => _handled = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Your Reward QR Code'),
        actions: [
          IconButton(
            icon: const Icon(Icons.card_giftcard),
            tooltip: 'My Rewards',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => MyRewardsScreen(config: widget.config)),
            ),
          ),
        ],
      ),
      body: MobileScanner(onDetect: _onDetect),
    );
  }
}
