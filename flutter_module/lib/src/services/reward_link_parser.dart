/// The printed QR encodes a deep link (`<scheme>://<host>?token=...`), not a
/// bare token, so a plain phone camera can open the app directly. This pulls
/// the token back out - and falls back to treating the raw scanned value as
/// a bare token, which keeps the in-app camera scanner working even if it
/// somehow reads a code that isn't a deep link (e.g. during testing).
String? parseRewardToken(String raw, {required String scheme, required String host}) {
  final uri = Uri.tryParse(raw);
  if (uri != null && uri.scheme == scheme && uri.host == host) {
    return uri.queryParameters['token'];
  }
  return raw.isNotEmpty ? raw : null;
}
