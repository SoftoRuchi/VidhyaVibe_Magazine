import '../config/apiConfig.dart';
import '../models/course_study.dart';
import 'api_client.dart';

class CourseStudyService {
  CourseStudyService._();

  static Future<CourseStudyData> load(int chapterId) async {
    final res = await ApiClient.get(ApiConfig.courseChapterStudyUrl(chapterId));
    if (!ApiClient.isOk(res)) {
      return CourseStudyData(bookmarks: const [], notes: const [], highlights: const []);
    }
    return CourseStudyData.fromJson(ApiClient.decodeMap(res));
  }

  static Future<CourseBookmark?> addBookmark({
    required int chapterId,
    required int pageNumber,
    String markType = 'important',
  }) async {
    final res = await ApiClient.post(
      ApiConfig.courseChapterBookmarksUrl(chapterId),
      body: {'pageNumber': pageNumber, 'markType': normalizeBookmarkType(markType)},
    );
    if (!ApiClient.isOk(res)) return null;
    return CourseBookmark.fromJson(ApiClient.decodeMap(res));
  }

  static Future<bool> removeBookmark(int id) async {
    final res = await ApiClient.delete(ApiConfig.courseBookmarkUrl(id));
    return ApiClient.isOk(res);
  }

  static Future<CourseNoteItem?> addNote({
    required int chapterId,
    required String content,
    int? pageNumber,
    String? quote,
  }) async {
    final trimmedQuote = quote?.trim();
    final res = await ApiClient.post(
      ApiConfig.courseChapterNotesUrl(chapterId),
      body: {
        'content': content,
        if (pageNumber != null) 'pageNumber': pageNumber,
        if (trimmedQuote != null && trimmedQuote.isNotEmpty) 'quote': trimmedQuote,
      },
    );
    if (!ApiClient.isOk(res)) return null;
    return CourseNoteItem.fromJson(ApiClient.decodeMap(res));
  }

  static Future<bool> updateNote(int id, String content) async {
    final res = await ApiClient.put(
      ApiConfig.courseNoteUrl(id),
      body: {'content': content},
    );
    return ApiClient.isOk(res);
  }

  static Future<bool> deleteNote(int id) async {
    final res = await ApiClient.delete(ApiConfig.courseNoteUrl(id));
    return ApiClient.isOk(res);
  }

  static Future<CourseHighlightItem?> addHighlight({
    required int chapterId,
    required String text,
    int? pageNumber,
    String color = '#FFE66D',
  }) async {
    final res = await ApiClient.post(
      ApiConfig.courseChapterHighlightsUrl(chapterId),
      body: {
        'text': text,
        'color': color,
        if (pageNumber != null) 'pageNumber': pageNumber,
      },
    );
    if (!ApiClient.isOk(res)) return null;
    return CourseHighlightItem.fromJson(ApiClient.decodeMap(res));
  }

  static Future<bool> deleteHighlight(int id) async {
    final res = await ApiClient.delete(ApiConfig.courseHighlightUrl(id));
    return ApiClient.isOk(res);
  }

  static Future<List<CourseFlashcard>> loadFlashcards(int chapterId) async {
    final res = await ApiClient.get(ApiConfig.courseChapterFlashcardsUrl(chapterId));
    if (!ApiClient.isOk(res)) return const [];
    return ApiClient.decodeList(res)
        .whereType<Map>()
        .map((e) => CourseFlashcard.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<CourseFlashcard?> addFlashcard({
    required int chapterId,
    required String front,
    required String back,
    int? pageNumber,
  }) async {
    final res = await ApiClient.post(
      ApiConfig.courseChapterFlashcardsUrl(chapterId),
      body: {
        'front': front,
        'back': back,
        if (pageNumber != null) 'pageNumber': pageNumber,
      },
    );
    if (!ApiClient.isOk(res)) return null;
    return CourseFlashcard.fromJson(ApiClient.decodeMap(res));
  }

  static Future<bool> deleteFlashcard(int id) async {
    final res = await ApiClient.delete(ApiConfig.courseFlashcardUrl(id));
    return ApiClient.isOk(res);
  }
}
