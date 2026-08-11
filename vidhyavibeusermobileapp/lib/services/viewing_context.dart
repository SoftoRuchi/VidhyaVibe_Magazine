import 'package:shared_preferences/shared_preferences.dart';

/// Parent vs child viewing mode — mirrors web viewingContext.ts
enum LoginAudience { parent, child }

class ViewingContext {
  ViewingContext._();

  static const _audienceKey = 'login_audience';
  static const _readerIdKey = 'selected_reader_id';
  static const _readerNameKey = 'selected_reader_name';

  static Future<void> setParentAudience() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_audienceKey, 'parent');
    await prefs.remove(_readerIdKey);
    await prefs.remove(_readerNameKey);
  }

  static Future<void> setChildAudience({
    required int readerId,
    required String readerName,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_audienceKey, 'child');
    await prefs.setString(_readerIdKey, readerId.toString());
    await prefs.setString(_readerNameKey, readerName);
  }

  static Future<LoginAudience> getAudience() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_audienceKey) == 'child'
        ? LoginAudience.child
        : LoginAudience.parent;
  }

  static Future<bool> isChildAudience() async {
    return await getAudience() == LoginAudience.child;
  }

  static Future<int?> getSelectedReaderId() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_readerIdKey);
    if (raw == null) return null;
    return int.tryParse(raw);
  }

  static Future<String?> getSelectedReaderName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_readerNameKey);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_audienceKey);
    await prefs.remove(_readerIdKey);
    await prefs.remove(_readerNameKey);
  }
}
