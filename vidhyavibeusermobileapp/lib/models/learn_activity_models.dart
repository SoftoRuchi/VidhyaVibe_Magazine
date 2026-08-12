class LearnSubject {
  LearnSubject({required this.id, required this.name, required this.slug});

  final int id;
  final String name;
  final String slug;

  factory LearnSubject.fromJson(Map<String, dynamic> json) {
    return LearnSubject(
      id: int.tryParse('${json['id']}') ?? 0,
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
    );
  }
}

class LearnActivitySummary {
  LearnActivitySummary({
    required this.id,
    required this.title,
    required this.activityType,
    this.description,
    this.subjectName,
    this.subjectSlug,
    this.difficulty = 'Easy',
    this.estimatedMinutes = 10,
    this.points = 10,
    this.progressStatus = 'NOT_STARTED',
    this.ageBands = const [],
  });

  final int id;
  final String title;
  final String activityType;
  final String? description;
  final String? subjectName;
  final String? subjectSlug;
  final String difficulty;
  final int estimatedMinutes;
  final int points;
  final String progressStatus;
  final List<String> ageBands;

  factory LearnActivitySummary.fromJson(Map<String, dynamic> json) {
    return LearnActivitySummary(
      id: int.tryParse('${json['id']}') ?? 0,
      title: json['title']?.toString() ?? 'Activity',
      activityType: json['activityType']?.toString() ?? 'QUIZ',
      description: json['description']?.toString(),
      subjectName: json['subjectName']?.toString(),
      subjectSlug: json['subjectSlug']?.toString(),
      difficulty: json['difficulty']?.toString() ?? 'Easy',
      estimatedMinutes: int.tryParse('${json['estimatedMinutes']}') ?? 10,
      points: int.tryParse('${json['points']}') ?? 10,
      progressStatus: json['progressStatus']?.toString() ?? 'NOT_STARTED',
      ageBands: (json['ageBands'] is List)
          ? (json['ageBands'] as List).map((e) => e.toString()).toList()
          : const [],
    );
  }
}

class LearnActivityDetail {
  LearnActivityDetail({
    required this.id,
    required this.title,
    required this.activityType,
    required this.config,
    this.description,
    this.instructions,
    this.subjectName,
    this.difficulty = 'Easy',
    this.estimatedMinutes = 10,
    this.points = 10,
    this.successMessage,
    this.explanation,
    this.badgeLabel,
  });

  final int id;
  final String title;
  final String activityType;
  final Map<String, dynamic> config;
  final String? description;
  final String? instructions;
  final String? subjectName;
  final String difficulty;
  final int estimatedMinutes;
  final int points;
  final String? successMessage;
  final String? explanation;
  final String? badgeLabel;

  factory LearnActivityDetail.fromJson(Map<String, dynamic> json) {
    final cfg = json['config'];
    return LearnActivityDetail(
      id: int.tryParse('${json['id']}') ?? 0,
      title: json['title']?.toString() ?? 'Activity',
      activityType: json['activityType']?.toString() ?? 'QUIZ',
      config: cfg is Map
          ? Map<String, dynamic>.from(cfg)
          : <String, dynamic>{},
      description: json['description']?.toString(),
      instructions: json['instructions']?.toString(),
      subjectName: json['subjectName']?.toString(),
      difficulty: json['difficulty']?.toString() ?? 'Easy',
      estimatedMinutes: int.tryParse('${json['estimatedMinutes']}') ?? 10,
      points: int.tryParse('${json['points']}') ?? 10,
      successMessage: json['successMessage']?.toString(),
      explanation: json['explanation']?.toString(),
      badgeLabel: json['badgeLabel']?.toString(),
    );
  }
}

class LearnCompleteResult {
  LearnCompleteResult({
    required this.resultStatus,
    required this.resultMessage,
    required this.explanation,
    required this.score,
    required this.pointsEarned,
    this.appreciation,
    this.pointsCredited = 0,
    this.walletSpent = 0,
    this.walletBalance,
  });

  final String resultStatus;
  final String resultMessage;
  final String explanation;
  final num score;
  final int pointsEarned;
  final String? appreciation;
  final int pointsCredited;
  final int walletSpent;
  final int? walletBalance;

  factory LearnCompleteResult.fromJson(Map<String, dynamic> json) {
    final details = json['details'];
    return LearnCompleteResult(
      resultStatus: json['resultStatus']?.toString() ?? 'COMPLETED_SUCCESS',
      resultMessage: json['resultMessage']?.toString() ?? '',
      explanation: json['explanation']?.toString() ?? '',
      score: num.tryParse('${json['score']}') ?? 0,
      pointsEarned: int.tryParse('${json['pointsEarned']}') ?? 0,
      appreciation: details is Map ? details['appreciation']?.toString() : null,
      pointsCredited: int.tryParse('${json['pointsCredited']}') ?? 0,
      walletSpent: int.tryParse('${json['walletSpent']}') ?? 0,
      walletBalance: json['walletBalance'] != null
          ? int.tryParse('${json['walletBalance']}')
          : null,
    );
  }
}
