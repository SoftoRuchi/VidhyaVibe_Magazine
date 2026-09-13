import 'package:flutter/material.dart';

import '../models/course_models.dart';
import 'auth_widgets.dart';

class CourseQuickQuestion {
  const CourseQuickQuestion({
    required this.prompt,
    required this.options,
    this.correctIndex,
    this.explanation,
  });

  final String prompt;
  final List<String> options;
  final int? correctIndex;
  final String? explanation;
}

class CourseQuickCheckItem {
  const CourseQuickCheckItem({
    required this.id,
    required this.title,
    required this.questions,
    this.pageNumber,
  });

  final int id;
  final String title;
  final int? pageNumber;
  final List<CourseQuickQuestion> questions;
}

String _optionLabel(dynamic o) {
  if (o is Map) return '${o['label'] ?? o}';
  return '$o';
}

List<CourseQuickQuestion> questionsFromConfig(Map<String, dynamic> config, {String? fallbackExplanation}) {
  final raw = config['questions'];
  if (raw is List && raw.isNotEmpty) {
    return raw.whereType<Map>().map((q) {
      final opts = q['options'] is List ? (q['options'] as List).map(_optionLabel).toList() : <String>[];
      return CourseQuickQuestion(
        prompt: q['prompt']?.toString() ?? '',
        options: opts,
        correctIndex: int.tryParse('${q['correctIndex']}'),
        explanation: q['explanation']?.toString() ?? fallbackExplanation,
      );
    }).where((q) => q.prompt.isNotEmpty && q.options.length >= 2).toList();
  }
  final prompt = config['prompt']?.toString();
  final optionsRaw = config['options'];
  if (prompt == null || optionsRaw is! List || optionsRaw.isEmpty) return const [];
  final opts = optionsRaw.map(_optionLabel).toList();
  var correct = int.tryParse('${config['correctIndex']}');
  final correctId = config['correctOptionId']?.toString();
  if (correct == null && correctId != null) {
    final idx = optionsRaw.indexWhere((o) => o is Map && '${o['id']}' == correctId);
    correct = idx < 0 ? null : idx;
  }
  return [
    CourseQuickQuestion(
      prompt: prompt,
      options: opts,
      correctIndex: correct,
      explanation: config['explanation']?.toString() ?? fallbackExplanation,
    ),
  ];
}

List<CourseQuickCheckItem> quickChecksFromActivities(List<CourseChapterActivity> activities) {
  final inline = activities.where((a) => a.placement == 'INLINE').toList();
  final source = inline.isNotEmpty
      ? inline
      : activities.where((a) => a.activityType == 'QUIZ').take(1).toList();
  return [
    for (final a in source)
      if (questionsFromConfig(a.config).isNotEmpty)
        CourseQuickCheckItem(
          id: a.id,
          title: a.title,
          pageNumber: a.pageNumber,
          questions: questionsFromConfig(a.config).take(3).toList(),
        ),
  ];
}

class CourseQuickCheckView extends StatefulWidget {
  const CourseQuickCheckView({super.key, required this.item});

  final CourseQuickCheckItem item;

  @override
  State<CourseQuickCheckView> createState() => _CourseQuickCheckViewState();
}

class _CourseQuickCheckViewState extends State<CourseQuickCheckView> {
  int _qIndex = 0;
  int? _picked;
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final questions = widget.item.questions;
    if (questions.isEmpty) return const SizedBox.shrink();
    final q = questions[_qIndex.clamp(0, questions.length - 1)];
    final correct = q.correctIndex;
    final ok = _revealed && _picked != null && correct != null && _picked == correct;
    final wrong = _revealed && _picked != null && correct != null && _picked != correct;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            questions.length > 1
                ? 'Quick check · ${_qIndex + 1} of ${questions.length}'
                : 'Quick check',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AuthTheme.mutedBrown,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.item.title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AuthTheme.brown),
          ),
          const SizedBox(height: 12),
          Text(q.prompt, style: const TextStyle(fontSize: 16, height: 1.4, color: AuthTheme.brown)),
          const SizedBox(height: 12),
          for (var i = 0; i < q.options.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(
                onPressed: _revealed ? null : () => setState(() => _picked = i),
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  foregroundColor: AuthTheme.brown,
                  side: BorderSide(
                    color: _revealed && correct == i
                        ? AuthTheme.green
                        : _revealed && _picked == i
                            ? const Color(0xFFC4452D)
                            : _picked == i
                                ? AuthTheme.green
                                : const Color(0xFFD3BFA0),
                  ),
                  backgroundColor: _revealed && correct == i
                      ? AuthTheme.green.withValues(alpha: 0.12)
                      : _revealed && _picked == i
                          ? const Color(0x14C4452D)
                          : _picked == i
                              ? AuthTheme.green.withValues(alpha: 0.08)
                              : Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
                child: Text(q.options[i], style: const TextStyle(height: 1.35)),
              ),
            ),
          if (_revealed)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                '${ok ? 'Correct.' : wrong ? 'Not quite.' : 'Checked.'} ${q.explanation ?? ''}'.trim(),
                style: TextStyle(
                  height: 1.4,
                  color: ok ? AuthTheme.green : AuthTheme.brown,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (!_revealed)
            FilledButton(
              onPressed: _picked == null ? null : () => setState(() => _revealed = true),
              style: FilledButton.styleFrom(backgroundColor: AuthTheme.green),
              child: const Text('Check'),
            )
          else if (_qIndex < questions.length - 1)
            FilledButton(
              onPressed: () => setState(() {
                _qIndex += 1;
                _picked = null;
                _revealed = false;
              }),
              style: FilledButton.styleFrom(backgroundColor: AuthTheme.green),
              child: const Text('Next question'),
            )
          else
            const Text(
              'Done. Keep reading, or open Practice for the full quiz.',
              style: TextStyle(color: AuthTheme.mutedBrown),
            ),
        ],
      ),
    );
  }
}
