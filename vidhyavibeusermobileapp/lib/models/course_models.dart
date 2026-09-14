int? _asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  return int.tryParse(v.toString());
}

class CourseSummary {
  CourseSummary({
    required this.id,
    required this.name,
    required this.slug,
    this.university,
    this.description,
    this.semesterCount = 0,
  });

  final int id;
  final String name;
  final String slug;
  final String? university;
  final String? description;
  final int semesterCount;

  factory CourseSummary.fromJson(Map<String, dynamic> json) {
    return CourseSummary(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      university: json['university']?.toString(),
      description: json['description']?.toString(),
      semesterCount: _asInt(json['semesterCount']) ?? 0,
    );
  }
}

class CourseSemesterSummary {
  CourseSemesterSummary({
    required this.id,
    required this.number,
    required this.title,
    this.subjectCount = 0,
  });

  final int id;
  final int number;
  final String title;
  final int subjectCount;

  factory CourseSemesterSummary.fromJson(Map<String, dynamic> json) {
    return CourseSemesterSummary(
      id: _asInt(json['id']) ?? 0,
      number: _asInt(json['number']) ?? 0,
      title: json['title']?.toString() ?? 'Semester',
      subjectCount: _asInt(json['subjectCount']) ?? 0,
    );
  }
}

class CourseDetail {
  CourseDetail({
    required this.id,
    required this.name,
    required this.slug,
    this.university,
    this.description,
    this.semesters = const [],
  });

  final int id;
  final String name;
  final String slug;
  final String? university;
  final String? description;
  final List<CourseSemesterSummary> semesters;

  factory CourseDetail.fromJson(Map<String, dynamic> json) {
    final raw = json['semesters'];
    return CourseDetail(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      university: json['university']?.toString(),
      description: json['description']?.toString(),
      semesters: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => CourseSemesterSummary.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

class CourseSubjectSummary {
  CourseSubjectSummary({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.syllabusCode,
    this.chapterCount = 0,
  });

  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? syllabusCode;
  final int chapterCount;

  factory CourseSubjectSummary.fromJson(Map<String, dynamic> json) {
    return CourseSubjectSummary(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      description: json['description']?.toString(),
      syllabusCode: json['syllabusCode']?.toString(),
      chapterCount: _asInt(json['chapterCount']) ?? 0,
    );
  }
}

class CourseSemesterPageData {
  CourseSemesterPageData({
    required this.courseName,
    required this.courseSlug,
    required this.semesterNumber,
    required this.semesterTitle,
    required this.subjects,
  });

  final String courseName;
  final String courseSlug;
  final int semesterNumber;
  final String semesterTitle;
  final List<CourseSubjectSummary> subjects;

  factory CourseSemesterPageData.fromJson(Map<String, dynamic> json) {
    final course = json['course'] is Map ? Map<String, dynamic>.from(json['course'] as Map) : {};
    final semester = json['semester'] is Map ? Map<String, dynamic>.from(json['semester'] as Map) : {};
    final raw = json['subjects'];
    return CourseSemesterPageData(
      courseName: course['name']?.toString() ?? '',
      courseSlug: course['slug']?.toString() ?? '',
      semesterNumber: _asInt(semester['number']) ?? 0,
      semesterTitle: semester['title']?.toString() ?? 'Semester',
      subjects: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => CourseSubjectSummary.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

class CourseChapterSummary {
  CourseChapterSummary({
    required this.id,
    required this.title,
    required this.slug,
    this.activityCount = 0,
  });

  final int id;
  final String title;
  final String slug;
  final int activityCount;

  factory CourseChapterSummary.fromJson(Map<String, dynamic> json) {
    return CourseChapterSummary(
      id: _asInt(json['id']) ?? 0,
      title: json['title']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      activityCount: _asInt(json['activityCount']) ?? 0,
    );
  }
}

class CourseSubjectDetail {
  CourseSubjectDetail({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.syllabusCode,
    required this.courseName,
    required this.courseSlug,
    required this.semesterNumber,
    required this.semesterTitle,
    this.chapters = const [],
  });

  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? syllabusCode;
  final String courseName;
  final String courseSlug;
  final int semesterNumber;
  final String semesterTitle;
  final List<CourseChapterSummary> chapters;

  factory CourseSubjectDetail.fromJson(Map<String, dynamic> json) {
    final course = json['course'] is Map ? Map<String, dynamic>.from(json['course'] as Map) : {};
    final semester = json['semester'] is Map ? Map<String, dynamic>.from(json['semester'] as Map) : {};
    final raw = json['chapters'];
    return CourseSubjectDetail(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      description: json['description']?.toString(),
      syllabusCode: json['syllabusCode']?.toString(),
      courseName: course['name']?.toString() ?? '',
      courseSlug: course['slug']?.toString() ?? '',
      semesterNumber: _asInt(semester['number']) ?? 0,
      semesterTitle: semester['title']?.toString() ?? '',
      chapters: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => CourseChapterSummary.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

class CourseChapterActivity {
  CourseChapterActivity({
    required this.id,
    required this.title,
    required this.activityType,
    required this.placement,
    this.instructions,
    this.config = const {},
    this.pageNumber,
  });

  final int id;
  final String title;
  final String activityType;
  final String placement;
  final String? instructions;
  final Map<String, dynamic> config;
  final int? pageNumber;

  factory CourseChapterActivity.fromJson(Map<String, dynamic> json) {
    final cfg = json['config'];
    return CourseChapterActivity(
      id: _asInt(json['id']) ?? 0,
      title: json['title']?.toString() ?? '',
      activityType: json['activityType']?.toString() ?? '',
      placement: json['placement']?.toString() ?? 'PRACTICE',
      instructions: json['instructions']?.toString(),
      config: cfg is Map ? Map<String, dynamic>.from(cfg) : const {},
      pageNumber: _asInt(json['pageNumber']),
    );
  }
}

class CourseChapterDetail {
  CourseChapterDetail({
    required this.id,
    required this.title,
    required this.slug,
    required this.content,
    required this.subjectId,
    required this.subjectName,
    required this.subjectSlug,
    required this.courseName,
    this.startPage,
    this.endPage,
    this.frontCoverUrl,
    this.backCoverUrl,
    this.activities = const [],
  });

  final int id;
  final String title;
  final String slug;
  final String content;
  final int subjectId;
  final String subjectName;
  final String subjectSlug;
  final String courseName;
  final int? startPage;
  final int? endPage;
  final String? frontCoverUrl;
  final String? backCoverUrl;
  final List<CourseChapterActivity> activities;

  factory CourseChapterDetail.fromJson(Map<String, dynamic> json) {
    final subject = json['subject'] is Map ? Map<String, dynamic>.from(json['subject'] as Map) : {};
    final course = json['course'] is Map ? Map<String, dynamic>.from(json['course'] as Map) : {};
    final raw = json['activities'];
    return CourseChapterDetail(
      id: _asInt(json['id']) ?? 0,
      title: json['title']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      subjectId: _asInt(subject['id']) ?? 0,
      subjectName: subject['name']?.toString() ?? '',
      subjectSlug: subject['slug']?.toString() ?? '',
      courseName: course['name']?.toString() ?? '',
      startPage: _asInt(json['startPage']),
      endPage: _asInt(json['endPage']),
      frontCoverUrl: subject['frontCoverUrl']?.toString(),
      backCoverUrl: subject['backCoverUrl']?.toString(),
      activities: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => CourseChapterActivity.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }

  CourseChapterActivity? get practiceQuiz {
    for (final a in activities) {
      if (a.activityType == 'QUIZ' && a.placement == 'PRACTICE') return a;
    }
    for (final a in activities) {
      if (a.activityType == 'QUIZ') return a;
    }
    for (final a in activities) {
      if (a.placement == 'PRACTICE') return a;
    }
    return activities.isEmpty ? null : activities.first;
  }
}

class CourseContinueReading {
  CourseContinueReading({
    required this.subjectId,
    required this.chapterId,
    this.currentPage,
    this.percent,
    this.chapterTitle,
    this.subjectName,
    this.courseName,
    this.university,
  });

  final int subjectId;
  final int chapterId;
  final int? currentPage;
  final int? percent;
  final String? chapterTitle;
  final String? subjectName;
  final String? courseName;
  final String? university;

  factory CourseContinueReading.fromJson(Map<String, dynamic> json) {
    return CourseContinueReading(
      subjectId: _asInt(json['subjectId']) ?? 0,
      chapterId: _asInt(json['chapterId']) ?? 0,
      currentPage: _asInt(json['currentPage']),
      percent: _asInt(json['percent']),
      chapterTitle: json['chapterTitle']?.toString(),
      subjectName: json['subjectName']?.toString(),
      courseName: json['courseName']?.toString(),
      university: json['university']?.toString(),
    );
  }

  String get subtitle {
    final parts = <String>[
      if (courseName != null && courseName!.isNotEmpty) courseName!,
      if (subjectName != null && subjectName!.isNotEmpty) subjectName!,
    ];
    return parts.join(' · ');
  }
}