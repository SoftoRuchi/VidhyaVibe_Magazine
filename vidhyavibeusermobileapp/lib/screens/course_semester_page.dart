import 'package:flutter/material.dart';

import '../models/course_models.dart';
import '../services/courses_service.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/course_browse.dart';
import 'course_subject_page.dart';

class CourseSemesterPage extends StatefulWidget {
  const CourseSemesterPage({
    super.key,
    required this.courseSlug,
    required this.semesterNumber,
  });

  final String courseSlug;
  final int semesterNumber;

  @override
  State<CourseSemesterPage> createState() => _CourseSemesterPageState();
}

class _CourseSemesterPageState extends State<CourseSemesterPage> {
  bool _loading = true;
  String? _error;
  CourseSemesterPageData? _data;

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
      final data = await CoursesService.getSemester(widget.courseSlug, widget.semesterNumber);
      if (!mounted) return;
      setState(() {
        _data = data;
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
    final data = _data;
    final subjects = data?.subjects ?? const <CourseSubjectSummary>[];
    return Scaffold(
      appBar: AuthTheme.buildAppBar(data?.semesterTitle ?? 'Semester'),
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
              if (data != null)
                CourseHeroCard(
                  kicker: data.courseName,
                  title: data.semesterTitle,
                  subtitle: 'Pick a subject to open the book and practise.',
                  chips: [courseCountLabel(subjects.length, 'subject')],
                ),
              const SizedBox(height: 18),
              CourseSectionLabel(subjects.isEmpty ? 'Subjects' : 'Subjects in this semester'),
              if (subjects.isEmpty)
                const CourseEmptyCard(
                  message: 'No subjects have been added to this semester yet.',
                  icon: Icons.menu_book_outlined,
                )
              else
                ...subjects.map(
                  (s) => CourseNavCard(
                    icon: Icons.menu_book_rounded,
                    title: s.name,
                    subtitle: [
                      if (s.syllabusCode != null && s.syllabusCode!.isNotEmpty) s.syllabusCode,
                      courseCountLabel(s.chapterCount, 'chapter'),
                    ].join(' · '),
                    muted: s.chapterCount == 0,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CourseSubjectPage(subjectId: s.id),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
