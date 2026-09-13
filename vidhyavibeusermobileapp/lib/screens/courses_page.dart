import 'package:flutter/material.dart';

import '../models/course_models.dart';
import '../services/courses_service.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/course_browse.dart';
import 'course_detail_page.dart';

class CoursesPage extends StatefulWidget {
  const CoursesPage({super.key});

  @override
  State<CoursesPage> createState() => _CoursesPageState();
}

class _CoursesPageState extends State<CoursesPage> {
  bool _loading = true;
  String? _error;
  List<CourseSummary> _courses = [];

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
      final list = await CoursesService.list();
      if (!mounted) return;
      setState(() {
        _courses = list;
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
    return Scaffold(
      appBar: AuthTheme.buildAppBar('Courses'),
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
              const CourseHeroCard(
                kicker: 'VidhyaVibe courses',
                title: 'Read. Practise. Revise.',
                subtitle: 'University textbooks you can read like a book, then practise with quizzes.',
              ),
              const SizedBox(height: 18),
              CourseSectionLabel(_courses.isEmpty ? 'Courses' : 'Your programmes'),
              if (_courses.isEmpty)
                const CourseEmptyCard(message: 'No courses published yet.')
              else
                ..._courses.map(
                  (c) => CourseNavCard(
                    icon: Icons.school_outlined,
                    title: c.name,
                    subtitle: [
                      if (c.university != null && c.university!.isNotEmpty) c.university,
                      courseCountLabel(c.semesterCount, 'semester'),
                    ].join(' · '),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CourseDetailPage(slug: c.slug),
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