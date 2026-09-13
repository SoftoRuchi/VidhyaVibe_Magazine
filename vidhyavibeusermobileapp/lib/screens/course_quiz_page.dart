import 'package:flutter/material.dart';

import '../models/course_models.dart';
import '../models/learn_activity_models.dart';
import '../services/courses_service.dart';
import '../services/learn_activities_service.dart';
import '../widgets/auth_widgets.dart';

class CourseQuizPage extends StatefulWidget {
  const CourseQuizPage({super.key, required this.chapterId});

  final int chapterId;

  @override
  State<CourseQuizPage> createState() => _CourseQuizPageState();
}

class _QuizQuestion {
  _QuizQuestion({required this.prompt, required this.options, this.correctIndex});
  final String prompt;
  final List<String> options;
  final int? correctIndex;
}

class _CourseQuizPageState extends State<CourseQuizPage> {
  bool _loading = true;
  String? _error;
  CourseChapterDetail? _chapter;
  CourseChapterActivity? _activity;
  List<_QuizQuestion> _questions = [];
  List<int> _answers = [];
  bool _practiceOnly = false;
  bool _submitting = false;
  LearnCompleteResult? _result;
  DateTime? _startedAt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<_QuizQuestion> _parseQuestions(Map<String, dynamic> config) {
    final raw = config['questions'];
    if (raw is List && raw.isNotEmpty) {
      return raw.whereType<Map>().map((q) {
        final opts = q['options'] is List
            ? (q['options'] as List)
                .map((o) => o is Map ? '${o['label'] ?? o}' : '$o')
                .toList()
            : <String>[];
        return _QuizQuestion(
          prompt: q['prompt']?.toString() ?? '',
          options: opts,
          correctIndex: int.tryParse('${q['correctIndex']}'),
        );
      }).toList();
    }
    final prompt = config['prompt']?.toString();
    final optionsRaw = config['options'];
    if (prompt != null && optionsRaw is List && optionsRaw.isNotEmpty) {
      final opts = optionsRaw
          .map((o) => o is Map ? '${o['label'] ?? o}' : '$o')
          .toList();
      var correct = int.tryParse('${config['correctIndex']}');
      final correctId = config['correctOptionId']?.toString();
      if (correct == null && correctId != null) {
        final idx = optionsRaw.indexWhere(
          (o) => o is Map && '${o['id']}' == correctId,
        );
        correct = idx < 0 ? null : idx;
      }
      return [_QuizQuestion(prompt: prompt, options: opts, correctIndex: correct)];
    }
    return [];
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final chapter = await CoursesService.getChapter(widget.chapterId);
      final activity = chapter.practiceQuiz;
      final questions = activity == null ? <_QuizQuestion>[] : _parseQuestions(activity.config);
      if (activity != null) {
        try {
          await LearnActivitiesService.start(activity.id);
        } catch (e) {
          final msg = e.toString().toLowerCase();
          if (msg.contains('already_completed') || msg.contains('already completed')) {
            _practiceOnly = true;
          } else {
            rethrow;
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _chapter = chapter;
        _activity = activity;
        _questions = questions;
        _answers = List<int>.filled(questions.length, -1);
        _startedAt = DateTime.now();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Map<String, dynamic> _responsePayload() {
    if (_questions.length > 1 || _activity?.activityType == 'QUIZ') {
      return {
        'answers': [
          for (final i in _answers) {'selectedIndex': i},
        ],
      };
    }
    final opts = _activity?.config['options'];
    String? selectedId;
    if (opts is List && _answers.isNotEmpty && _answers.first >= 0 && _answers.first < opts.length) {
      final o = opts[_answers.first];
      if (o is Map) selectedId = o['id']?.toString();
    }
    return {
      'selectedIndex': _answers.isEmpty ? -1 : _answers.first,
      if (selectedId != null) 'selectedOptionId': selectedId,
    };
  }

  LearnCompleteResult _localResult() {
    var correct = 0;
    for (var i = 0; i < _questions.length; i++) {
      if (_questions[i].correctIndex != null && _answers[i] == _questions[i].correctIndex) {
        correct += 1;
      }
    }
    final total = _questions.isEmpty ? 1 : _questions.length;
    final score = ((correct / total) * 100).round();
    return LearnCompleteResult(
      resultStatus: score == 100 ? 'CORRECT' : score >= 50 ? 'PARTIAL' : 'INCORRECT',
      resultMessage: _practiceOnly
          ? 'Practice score (already submitted earlier).'
          : 'Practice score.',
      explanation: '',
      score: score,
      pointsEarned: 0,
      appreciation: null,
      pointsCredited: 0,
      walletSpent: 0,
      walletBalance: null,
    );
  }

  Future<void> _submit() async {
    if (_activity == null || _submitting) return;
    if (_answers.any((a) => a < 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Answer every question before submitting.')),
      );
      return;
    }
    setState(() => _submitting = true);
    final elapsed = _startedAt == null
        ? 1
        : DateTime.now().difference(_startedAt!).inSeconds.clamp(1, 36000).toInt();
    try {
      if (!_practiceOnly) {
        final result = await LearnActivitiesService.complete(
          _activity!.id,
          response: _responsePayload(),
          timeSpentSec: elapsed,
        );
        if (!mounted) return;
        setState(() {
          _result = result;
          _submitting = false;
        });
        return;
      }
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (!(msg.contains('already_completed') || msg.contains('already completed'))) {
        if (!mounted) return;
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
        return;
      }
      _practiceOnly = true;
    }
    if (!mounted) return;
    setState(() {
      _result = _localResult();
      _submitting = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final chapter = _chapter;
    return Scaffold(
      appBar: AuthTheme.buildAppBar(_activity?.title ?? 'Practice'),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                    children: [
                      Row(
                        children: [
                          ChoiceChip(
                            label: const Text('Read'),
                            selected: false,
                            onSelected: (_) => Navigator.of(context).maybePop(),
                          ),
                          const SizedBox(width: 8),
                          const ChoiceChip(label: Text('Practice'), selected: true, onSelected: null),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (chapter != null)
                        Text(
                          '${chapter.courseName} · ${chapter.title}',
                          style: const TextStyle(
                            color: AuthTheme.green,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      if (_activity?.instructions != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _activity!.instructions!,
                          style: const TextStyle(color: AuthTheme.mutedBrown),
                        ),
                      ],
                      if (_practiceOnly)
                        const Padding(
                          padding: EdgeInsets.only(top: 12),
                          child: Text(
                            'You already submitted this quiz. You can still practise locally.',
                            style: TextStyle(color: AuthTheme.mutedBrown),
                          ),
                        ),
                      const SizedBox(height: 16),
                      if (_questions.isEmpty)
                        const Text('No quiz is attached to this chapter yet.')
                      else if (_result != null)
                        _ResultCard(result: _result!)
                      else ...[
                        for (var i = 0; i < _questions.length; i++)
                          _QuestionCard(
                            index: i,
                            question: _questions[i],
                            selected: _answers[i],
                            onSelect: (v) {
                              setState(() => _answers[i] = v);
                            },
                          ),
                        const SizedBox(height: 8),
                        ElevatedButton(
                          onPressed: _submitting ? null : _submit,
                          style: AuthTheme.primaryButtonStyle,
                          child: Text(_submitting ? 'Submitting…' : 'Submit quiz'),
                        ),
                      ],
                    ],
                  ),
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.index,
    required this.question,
    required this.selected,
    required this.onSelect,
  });

  final int index;
  final _QuizQuestion question;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${index + 1}. ${question.prompt}',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AuthTheme.brown,
            ),
          ),
          const SizedBox(height: 8),
          for (var oi = 0; oi < question.options.length; oi++)
            RadioListTile<int>(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(question.options[oi]),
              value: oi,
              groupValue: selected < 0 ? null : selected,
              onChanged: (v) {
                if (v != null) onSelect(v);
              },
            ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});

  final LearnCompleteResult result;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Score: ${result.score}%',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AuthTheme.brown,
            ),
          ),
          const SizedBox(height: 8),
          Text(result.resultMessage),
          if (result.explanation.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(result.explanation),
          ],
        ],
      ),
    );
  }
}