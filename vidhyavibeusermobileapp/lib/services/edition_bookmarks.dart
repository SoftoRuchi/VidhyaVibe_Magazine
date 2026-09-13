import 'package:shared_preferences/shared_preferences.dart';

import '../config/apiConfig.dart';
import 'api_client.dart';
import 'viewing_context.dart';

class EditionBookmark {
  EditionBookmark({required this.id, required this.pageNumber});

  final int id;
  final int pageNumber;
}

class EditionBookmarks {
  EditionBookmarks._();

  static String _localKey(int editionId) => 'vv_bookmarks_$editionId';

  static Future<int?> resolveReaderId() async {
    final selected = await ViewingContext.getSelectedReaderId();
    if (selected != null) return selected;
    try {
      final res = await ApiClient.listReaders();
      if (!ApiClient.isOk(res)) return null;
      final list = ApiClient.decodeList(res).whereType<Map>();
      if (list.isEmpty) return null;
      return int.tryParse('${list.first['id']}');
    } catch (_) {
      return null;
    }
  }

  static Future<List<int>> _localPages(int editionId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_localKey(editionId));
    if (raw == null || raw.isEmpty) return [];
    return raw
        .split(',')
        .map((e) => int.tryParse(e.trim()))
        .whereType<int>()
        .where((p) => p > 0)
        .toList();
  }

  static Future<void> _setLocalPages(int editionId, List<int> pages) async {
    final prefs = await SharedPreferences.getInstance();
    final unique = pages.toSet().toList()..sort();
    if (unique.isEmpty) {
      await prefs.remove(_localKey(editionId));
      return;
    }
    await prefs.setString(_localKey(editionId), unique.join(','));
  }

  static List<EditionBookmark> _fromPages(List<int> pages) {
    return pages.map((p) => EditionBookmark(id: -p, pageNumber: p)).toList();
  }

  static Future<List<EditionBookmark>> list({
    required int editionId,
    int? readerId,
  }) async {
    final id = readerId ?? await resolveReaderId();
    if (id != null) {
      try {
        final res = await ApiClient.get(
          ApiConfig.bookmarksUrl(editionId: editionId, readerId: id),
        );
        if (ApiClient.isOk(res)) {
          final data = ApiClient.decodeMap(res);
          final items = data['items'];
          final out = <EditionBookmark>[];
          if (items is List) {
            for (final raw in items.whereType<Map>()) {
              final page = int.tryParse('${raw['pageNumber']}');
              final bookmarkId = int.tryParse('${raw['id']}');
              if (page == null || bookmarkId == null || page < 1) continue;
              out.add(EditionBookmark(id: bookmarkId, pageNumber: page));
            }
          }
          await _setLocalPages(
            editionId,
            out.map((b) => b.pageNumber).toList(),
          );
          return out;
        }
      } catch (_) {}
    }
    return _fromPages(await _localPages(editionId));
  }

  static Future<EditionBookmark?> add({
    required int editionId,
    required int pageNumber,
    int? readerId,
  }) async {
    final id = readerId ?? await resolveReaderId();
    if (id != null) {
      try {
        final res = await ApiClient.post(
          ApiConfig.bookmarksUrl(),
          body: {
            'readerId': id,
            'editionId': editionId,
            'pageNumber': pageNumber,
          },
        );
        if (ApiClient.isOk(res)) {
          final data = ApiClient.decodeMap(res);
          final bookmarkId = int.tryParse('${data['id']}');
          final pages = await _localPages(editionId);
          if (!pages.contains(pageNumber)) {
            await _setLocalPages(editionId, [...pages, pageNumber]);
          }
          return EditionBookmark(
            id: bookmarkId ?? -pageNumber,
            pageNumber: pageNumber,
          );
        }
      } catch (_) {}
    }

    final pages = await _localPages(editionId);
    if (!pages.contains(pageNumber)) {
      await _setLocalPages(editionId, [...pages, pageNumber]);
    }
    return EditionBookmark(id: -pageNumber, pageNumber: pageNumber);
  }

  static Future<bool> remove(
    int bookmarkId, {
    int? editionId,
    int? pageNumber,
  }) async {
    var ok = bookmarkId <= 0;
    if (bookmarkId > 0) {
      try {
        final res = await ApiClient.delete(ApiConfig.bookmarkUrl(bookmarkId));
        ok = ApiClient.isOk(res);
      } catch (_) {
        ok = false;
      }
    }
    if (editionId != null) {
      final page = pageNumber ?? (bookmarkId < 0 ? -bookmarkId : null);
      if (page != null) {
        final pages = await _localPages(editionId);
        await _setLocalPages(
          editionId,
          pages.where((p) => p != page).toList(),
        );
      }
    }
    return ok || bookmarkId <= 0;
  }
}
