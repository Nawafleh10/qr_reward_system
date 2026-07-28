/// Configuration for the QR Reward module. Pass your backend's base URL and
/// how the current customer's id should be resolved, so this module stays
/// decoupled from the host app's own auth/user system.
///
/// [deepLinkScheme] / [deepLinkHost] must match the values the backend uses
/// to build printed QR links (`<scheme>://<host>?token=...`, see
/// `backend/.env` -> APP_DEEP_LINK_SCHEME / APP_DEEP_LINK_HOST) and the
/// scheme registered in AndroidManifest.xml / Info.plist.
class RewardConfig {
  final String apiBaseUrl;
  final String Function() getCustomerId;
  final String deepLinkScheme;
  final String deepLinkHost;

  const RewardConfig({
    required this.apiBaseUrl,
    required this.getCustomerId,
    required this.deepLinkScheme,
    this.deepLinkHost = 'reward',
  });
}
