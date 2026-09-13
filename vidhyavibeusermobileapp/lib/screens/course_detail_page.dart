import 'package:flutter/material.dart';

import '../models/course_models.dart';
import '../services/courses_service.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/course_browse.dart';
import 'course_semester_page.dart';

class CourseDetailPage extends StatefulWidget {
  const CourseDetailPage({super.key, required this.slug});

  final String slug;

  @override
  State<CourseDetailPage> createState() => _CourseDetailPageState();
}

class _CourseDetailPageState extends State<CourseDetailPage> {
  bool _loading = true;
  String? _error;
  CourseDetail? _course;

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
      final course = await CoursesService.getCourse(widget.slug);
      if (!mounted) return;
      setState(() {
        _course = course;
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
    final course = _course;
    return Scaffold(
      appBar: AuthTheme.buildAppBar(course?.name ?? 'Course'),
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
              if (course != null)
                CourseHeroCard(
                  kicker: course.university,
                  title: course.name,
                  subtitle: course.description,
                  chips: [
                    courseCountLabel(course.semesters.length, 'semester'),
                    courseCountLabel(
                      course.semesters.fold<int>(0, (sum, s) => sum + s.subjectCount),
                      'subject',
                    ),
                  ],
                ),
              const SizedBox(height: 18),
              CourseSectionLabel(
                course == null || course.semesters.isEmpty
                    ? 'Semesters'
                    : 'Choose a semester',
              ),
              if (course == null || course.semesters.isEmpty)
                const CourseEmptyCard(message: 'No semesters in this course yet.')
              else
                ...course.semesters.map(
                  (s) => CourseNavCard(
                    badge: '${s.number}',
                    title: s.title,
                    subtitle: s.subjectCount == 0
                        ? 'No subjects yet'
                        : courseCountLabel(s.subjectCount, 'subject'),
                    muted: s.subjectCount == 0,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CourseSemesterPage(
                            courseSlug: widget.slug,
                            semesterNumber: s.number,
                          ),
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
