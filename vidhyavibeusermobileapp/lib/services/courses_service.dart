import '../config/apiConfig.dart';
import '../models/course_models.dart';
import 'api_client.dart';

class CoursesService {
  CoursesService._();

  static Future<List<CourseSummary>> list() async {
    final res = await ApiClient.get(ApiConfig.coursesUrl, auth: false);
    if (!ApiClient.isOk(res)) {
      throw Exception('Could not load courses (${res.statusCode})');
    }
    return ApiClient.decodeList(res)
        .whereType<Map>()
        .map((e) => CourseSummary.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<CourseDetail> getCourse(String slug) async {
    final res = await ApiClient.get(ApiConfig.courseUrl(slug), auth: false);
    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(data['error'] ?? 'Course not found');
    }
    return CourseDetail.fromJson(data);
  }

  static Future<CourseSemesterPageData> getSemester(String slug, int number) async {
    final res = await ApiClient.get(ApiConfig.courseSemesterUrl(slug, number), auth: false);
    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(data['error'] ?? 'Semester not found');
    }
    return CourseSemesterPageData.fromJson(data);
  }

  static Future<CourseSubjectDetail> getSubject(int id) async {
    final res = await ApiClient.get(ApiConfig.courseSubjectUrl(id));
    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(data['error'] ?? 'Subject not found');
    }
    return CourseSubjectDetail.fromJson(data);
  }

  static Future<CourseChapterDetail> getChapter(int id) async {
    final res = await ApiClient.get(ApiConfig.courseChapterUrl(id));
    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(data['error'] ?? 'Chapter not found');
    }
    return CourseChapterDetail.fromJson(data);
  }

  static Future<void> saveProgress({
    required int subjectId,
    int? chapterId,
    int? percent,
    int? currentPage,
  }) async {
    await ApiClient.post(
      ApiConfig.courseProgressUrl,
      body: {
        'subjectId': subjectId,
        if (chapterId != null) 'chapterId': chapterId,
        if (percent != null) 'percent': percent,
        if (currentPage != null) 'currentPage': currentPage,
      },
    );
  }

  static Future<CourseContinueReading?> continueReading() async {
    final res = await ApiClient.get(ApiConfig.courseContinueUrl);
    if (!ApiClient.isOk(res)) return null;
    final body = res.body.trim();
    if (body.isEmpty || body == 'null') return null;
    final data = ApiClient.decodeMap(res);
    if ((_asIntFromMap(data['chapterId']) ?? 0) <= 0) return null;
    return CourseContinueReading.fromJson(data);
  }
}

int? _asIntFromMap(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  return int.tryParse(v.toString());
}