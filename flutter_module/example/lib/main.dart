import 'package:flutter/material.dart';
import 'package:qr_reward_system/qr_reward_system.dart';

void main() => runApp(const DemoApp());

class DemoApp extends StatefulWidget {
  const DemoApp({super.key});

  @override
  State<DemoApp> createState() => _DemoAppState();
}

class _DemoAppState extends State<DemoApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  late final RewardConfig _config;
  late final RewardDeepLinkService _deepLinkService;

  @override
  void initState() {
    super.initState();

    _config = RewardConfig(
      apiBaseUrl: 'http://localhost:4000',
      // Replace with however the host app identifies the logged-in customer.
      getCustomerId: () => 'demo-customer-1',
      // Must match APP_DEEP_LINK_SCHEME in backend/.env and the scheme
      // registered in AndroidManifest.xml / Info.plist.
      deepLinkScheme: 'myrestaurant',
    );

    // Handles the case where a customer scans the printed QR with their
    // regular camera app and the OS launches straight into this app.
    _deepLinkService = RewardDeepLinkService(_config)
      ..start((token) {
        final context = _navigatorKey.currentContext;
        if (context != null) handleScannedToken(context, _config, token);
      });
  }

  @override
  void dispose() {
    _deepLinkService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: 'QR Reward Demo',
      // In-app scanner is still available as a manual fallback.
      home: QrScanScreen(config: _config),
    );
  }
}
