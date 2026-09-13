import 'package:flutter/material.dart';

import '../models/course_models.dart';
import '../services/courses_service.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/course_browse.dart';
import 'course_quiz_page.dart';
import 'course_reader_page.dart';

class CourseSubjectPage extends StatefulWidget {
  const CourseSubjectPage({super.key, required this.subjectId});

  final int subjectId;

  @override
  State<CourseSubjectPage> createState() => _CourseSubjectPageState();
}

class _CourseSubjectPageState extends State<CourseSubjectPage> {
  bool _loading = true;
  String? _error;
  CourseSubjectDetail? _subject;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final subject = await CoursesService.getSubject(widget.subjectId);
      if (!mounted) return;
      setState(() {
        _subject = subject;
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

  @override
  Widget build(BuildContext context) {
    final subject = _subject;
    final chapters = subject?.chapters ?? const <CourseChapterSummary>[];
    return Scaffold(
      appBar: AuthTheme.buildAppBar(subject?.name ?? 'Subject'),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: CourseBrowseBody(
          loading: _loading,
          error: _error,
          onRetry: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              if (subject != null)
                CourseHeroCard(
                  kicker: '${subject.courseName} · ${subject.semesterTitle}',
                  title: subject.name,
                  subtitle: subject.description,
                  chips: [
                    if (subject.syllabusCode != null && subject.syllabusCode!.isNotEmpty)
                      subject.syllabusCode!,
                    courseCountLabel(chapters.length, 'chapter'),
                  ],
                ),
              const SizedBox(height: 18),
              CourseSectionLabel(chapters.isEmpty ? 'Chapters' : 'Read a chapter'),
              if (chapters.isEmpty)
                const CourseEmptyCard(message: 'No chapters in this subject yet.')
              else
                ...chapters.asMap().entries.map((entry) {
                  final i = entry.key;
                  final ch = entry.value;
                  return _ChapterCard(
                    index: i + 1,
                    chapter: ch,
                    onRead: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CourseReaderPage(
                            subjectId: subject!.id,
                            chapterId: ch.id,
                            chapters: subject.chapters,
                          ),
                        ),
                      );
                    },
                    onPractice: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CourseQuizPage(chapterId: ch.id),
                        ),
                      );
                    },
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChapterCard extends StatelessWidget {
  const _ChapterCard({
    required this.index,
    required this.chapter,
    required this.onRead,
    required this.onPractice,
  });

  final int index;
  final CourseChapterSummary chapter;
  final VoidCallback onRead;
  final VoidCallback onPractice;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.12)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE7F3EA),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$index',
                    style: const TextStyle(
                      color: AuthTheme.green,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CHAPTER $index',
                        style: const TextStyle(
                          color: AuthTheme.green,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                          letterSpacing: 0.6,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        chapter.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          height: 1.25,
                          color: AuthTheme.brown,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onRead,
                    style: AuthTheme.primaryButtonStyle,
                    icon: const Icon(Icons.menu_book_outlined, size: 18),
                    label: const Text('Read'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onPractice,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AuthTheme.brown,
                      side: BorderSide(color: AuthTheme.brown.withValues(alpha: 0.28)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.quiz_outlined, size: 18),
                    label: const Text('Practice'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
