import 'package:shared_preferences/shared_preferences.dart';

/// Persists auth tokens (mirrors web localStorage access_token).
class AuthStorage {
  AuthStorage._();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _showPostLoginSetupKey = 'show_post_login_setup';

  static Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await prefs.setString(_refreshTokenKey, refreshToken);
    }
  }

  static Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessTokenKey);
  }

  static Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshTokenKey);
  }

  static Future<bool> isLoggedIn() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_showPostLoginSetupKey);
  }

  static Future<void> setShowPostLoginSetup(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value) {
      await prefs.setString(_showPostLoginSetupKey, '1');
    } else {
      await prefs.remove(_showPostLoginSetupKey);
    }
  }

  static Future<bool> shouldShowPostLoginSetup() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_showPostLoginSetupKey) == '1';
  }
}
