import 'dart:async';
import 'package:app_links/app_links.dart';

import 'reward_config.dart';

/// Listens for the OS handing the app a `<scheme>://<host>?token=...` link -
/// what happens when a customer points their regular phone camera at a
/// printed QR sticker. Reports only the extracted token; nothing about the
/// link itself is trusted further than that.
class RewardDeepLinkService {
  final RewardConfig config;
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;

  RewardDeepLinkService(this.config);

  String? _extractToken(Uri uri) {
    if (uri.scheme != config.deepLinkScheme || uri.host != config.deepLinkHost) {
      return null;
    }
    return uri.queryParameters['token'];
  }

  /// Call once at app startup, e.g. in your root widget's initState.
  /// [onToken] fires for the link that cold-started the app (if any) and
  /// for every link received while the app is already running.
  Future<void> start(void Function(String token) onToken) async {
    final initialLink = await _appLinks.getInitialAppLink();
    final initialToken = initialLink != null ? _extractToken(initialLink) : null;
    if (initialToken != null) onToken(initialToken);

    _subscription = _appLinks.uriLinkStream.listen((uri) {
      final token = _extractToken(uri);
      if (token != null) onToken(token);
    });
  }

  void dispose() {
    _subscription?.cancel();
  }
}
