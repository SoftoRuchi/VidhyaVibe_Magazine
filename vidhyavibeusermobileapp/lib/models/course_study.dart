int? _asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  return int.tryParse(v.toString());
}

String normalizeBookmarkType(String? value) {
  final type = (value ?? '').toLowerCase();
  if (type == 'doubt' || type == 'revise') return type;
  return 'important';
}

String bookmarkTypeLabel(String? value) {
  switch (normalizeBookmarkType(value)) {
    case 'doubt':
      return 'Doubt';
    case 'revise':
      return 'Revise';
    default:
      return 'Important';
  }
}

class CourseBookmark {
  CourseBookmark({
    required this.id,
    required this.pageNumber,
    this.markType = 'important',
  });
  final int id;
  final int pageNumber;
  final String markType;

  factory CourseBookmark.fromJson(Map<String, dynamic> json) {
    return CourseBookmark(
      id: _asInt(json['id']) ?? 0,
      pageNumber: _asInt(json['pageNumber']) ?? 0,
      markType: normalizeBookmarkType(json['markType']?.toString()),
    );
  }
}

class CourseNoteItem {
  CourseNoteItem({
    required this.id,
    required this.content,
    this.pageNumber,
    this.quote,
  });
  final int id;
  final String content;
  final int? pageNumber;
  final String? quote;

  factory CourseNoteItem.fromJson(Map<String, dynamic> json) {
    final quote = json['quote']?.toString().trim();
    return CourseNoteItem(
      id: _asInt(json['id']) ?? 0,
      content: json['content']?.toString() ?? '',
      pageNumber: _asInt(json['pageNumber']),
      quote: quote == null || quote.isEmpty ? null : quote,
    );
  }
}

class CourseHighlightItem {
  CourseHighlightItem({
    required this.id,
    required this.text,
    this.pageNumber,
    this.color = '#FFE66D',
  });
  final int id;
  final String text;
  final int? pageNumber;
  final String color;

  factory CourseHighlightItem.fromJson(Map<String, dynamic> json) {
    return CourseHighlightItem(
      id: _asInt(json['id']) ?? 0,
      text: json['text']?.toString() ?? '',
      pageNumber: _asInt(json['pageNumber']),
      color: json['color']?.toString() ?? '#FFE66D',
    );
  }
}

class CourseFlashcard {
  CourseFlashcard({
    required this.id,
    required this.front,
    required this.back,
    this.pageNumber,
    this.owned = false,
  });
  final int id;
  final String front;
  final String back;
  final int? pageNumber;
  final bool owned;

  factory CourseFlashcard.fromJson(Map<String, dynamic> json) {
    return CourseFlashcard(
      id: _asInt(json['id']) ?? 0,
      front: json['front']?.toString() ?? '',
      back: json['back']?.toString() ?? '',
      pageNumber: _asInt(json['pageNumber']),
      owned: json['owned'] == true,
    );
  }
}

class CourseStudyData {
  CourseStudyData({
    required this.bookmarks,
    required this.notes,
    required this.highlights,
  });
  final List<CourseBookmark> bookmarks;
  final List<CourseNoteItem> notes;
  final List<CourseHighlightItem> highlights;

  factory CourseStudyData.fromJson(Map<String, dynamic> json) {
    return CourseStudyData(
      bookmarks: (json['bookmarks'] as List? ?? [])
          .whereType<Map>()
          .map((e) => CourseBookmark.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      notes: (json['notes'] as List? ?? [])
          .whereType<Map>()
          .map((e) => CourseNoteItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      highlights: (json['highlights'] as List? ?? [])
          .whereType<Map>()
          .map((e) => CourseHighlightItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}
