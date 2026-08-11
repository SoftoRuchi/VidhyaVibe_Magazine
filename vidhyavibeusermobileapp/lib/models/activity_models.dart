class HouseholdItem {
  HouseholdItem({required this.id, required this.emoji, required this.name});

  final String id;
  final String emoji;
  final String name;

  factory HouseholdItem.fromJson(Map<String, dynamic> json) {
    return HouseholdItem(
      id: json['id']?.toString() ?? '',
      emoji: json['emoji']?.toString() ?? '🔹',
      name: json['name']?.toString() ?? '',
    );
  }
}

class PaintColour {
  PaintColour({required this.id, required this.name, required this.hex});

  final String id;
  final String name;
  final String hex;

  factory PaintColour.fromJson(Map<String, dynamic> json) {
    return PaintColour(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      hex: json['hex']?.toString() ?? '#888888',
    );
  }
}

class PackActivity {
  PackActivity({
    required this.id,
    required this.type,
    required this.title,
    required this.intro,
    this.badge,
    this.items = const [],
    this.correctPair = const [],
    this.reactionEmoji,
    this.reactionTitle,
    this.reactionExplain,
    this.whatIsMade,
    this.wrongPairHint,
    this.colours = const [],
    this.targetScene,
    this.paintSteps = const [],
    this.suggestedColourIds = const [],
    this.drawPrompt,
    this.drawTips = const [],
    this.puzzle,
    this.choices = const [],
    this.answerIndex,
    this.explanation,
    this.setup,
    this.options = const [],
    this.correctOptionIndex,
    this.question,
    this.questionOptions = const [],
    this.questionAnswerIndex,
    this.funFact,
    this.safetyTips = const [],
    this.learningBite,
    this.estimatedMinutes = 10,
  });

  final String id;
  final String type;
  final String title;
  final String intro;
  final String? badge;
  final List<HouseholdItem> items;
  final List<String> correctPair;
  final String? reactionEmoji;
  final String? reactionTitle;
  final String? reactionExplain;
  final String? whatIsMade;
  final String? wrongPairHint;
  final List<PaintColour> colours;
  final String? targetScene;
  final List<String> paintSteps;
  final List<String> suggestedColourIds;
  final String? drawPrompt;
  final List<String> drawTips;
  final String? puzzle;
  final List<String> choices;
  final int? answerIndex;
  final String? explanation;
  final String? setup;
  final List<String> options;
  final int? correctOptionIndex;
  final String? question;
  final List<String> questionOptions;
  final int? questionAnswerIndex;
  final String? funFact;
  final List<String> safetyTips;
  final String? learningBite;
  final int estimatedMinutes;

  factory PackActivity.fromJson(Map<String, dynamic> json) {
    return PackActivity(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'observe_quiz',
      title: json['title']?.toString() ?? 'Activity',
      intro: json['intro']?.toString() ?? '',
      badge: json['badge']?.toString(),
      items: (json['items'] is List)
          ? (json['items'] as List)
              .whereType<Map>()
              .map((e) => HouseholdItem.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      correctPair: (json['correctPair'] is List)
          ? (json['correctPair'] as List).map((e) => e.toString()).toList()
          : const [],
      reactionEmoji: json['reactionEmoji']?.toString(),
      reactionTitle: json['reactionTitle']?.toString(),
      reactionExplain: json['reactionExplain']?.toString(),
      whatIsMade: json['whatIsMade']?.toString(),
      wrongPairHint: json['wrongPairHint']?.toString(),
      colours: (json['colours'] is List)
          ? (json['colours'] as List)
              .whereType<Map>()
              .map((e) => PaintColour.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      targetScene: json['targetScene']?.toString(),
      paintSteps: _strList(json['paintSteps']),
      suggestedColourIds: _strList(json['suggestedColourIds']),
      drawPrompt: json['drawPrompt']?.toString(),
      drawTips: _strList(json['drawTips']),
      puzzle: json['puzzle']?.toString(),
      choices: _strList(json['choices']),
      answerIndex: _asInt(json['answerIndex']),
      explanation: json['explanation']?.toString(),
      setup: json['setup']?.toString(),
      options: _strList(json['options']),
      correctOptionIndex: _asInt(json['correctOptionIndex']),
      question: json['question']?.toString(),
      questionOptions: _strList(json['questionOptions']),
      questionAnswerIndex: _asInt(json['questionAnswerIndex']),
      funFact: json['funFact']?.toString(),
      safetyTips: _strList(json['safetyTips']),
      learningBite: json['learningBite']?.toString(),
      estimatedMinutes: _asInt(json['estimatedMinutes']) ?? 10,
    );
  }
}

class ActivityPack {
  ActivityPack({
    required this.packTitle,
    required this.subject,
    required this.ageGroup,
    required this.difficulty,
    required this.theme,
    required this.intro,
    required this.activities,
    this.source = 'ai',
  });

  final String packTitle;
  final String subject;
  final String ageGroup;
  final String difficulty;
  final String theme;
  final String intro;
  final List<PackActivity> activities;
  final String source;

  factory ActivityPack.fromJson(Map<String, dynamic> json) {
    return ActivityPack(
      packTitle: json['packTitle']?.toString() ?? 'Activity Pack',
      subject: json['subject']?.toString() ?? '',
      ageGroup: json['ageGroup']?.toString() ?? '',
      difficulty: json['difficulty']?.toString() ?? 'Easy',
      theme: json['theme']?.toString() ?? '',
      intro: json['intro']?.toString() ?? '',
      activities: (json['activities'] is List)
          ? (json['activities'] as List)
              .whereType<Map>()
              .map((e) => PackActivity.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      source: json['source']?.toString() ?? 'ai',
    );
  }
}

List<String> _strList(dynamic v) {
  if (v is! List) return const [];
  return v.map((e) => e.toString()).toList();
}

int? _asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  return int.tryParse(v.toString());
}
