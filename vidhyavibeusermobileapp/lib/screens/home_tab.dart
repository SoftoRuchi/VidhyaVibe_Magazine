import 'package:flutter/material.dart';

import '../config/apiConfig.dart';
import '../models/course_models.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/courses_service.dart';
import '../services/viewing_context.dart';
import '../widgets/auth_widgets.dart';
import 'course_reader_page.dart';
import 'login_page.dart';
import 'magazine_detail_page.dart';
import 'post_login_setup_page.dart';
import 'courses_page.dart';

/// Home tab content (used inside MainShell).
class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  bool _loading = true;
  String _welcomeName = 'Reader';
  LoginAudience _audience = LoginAudience.parent;
  UserProfile? _me;
  List<MagazineSummary> _magazines = [];
  CourseContinueReading? _continueReading;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final audience = await ViewingContext.getAudience();
      final childName = await ViewingContext.getSelectedReaderName();

      UserProfile? me;
      try {
        final meRes = await ApiClient.getMe();
        if (ApiClient.isOk(meRes)) {
          me = UserProfile.fromJson(ApiClient.decodeMap(meRes));
        }
      } catch (_) {}

      List<MagazineSummary> magazines = [];
      try {
        final magRes = await ApiClient.listMagazines();
        if (ApiClient.isOk(magRes)) {
          magazines = ApiClient.decodeList(magRes)
              .whereType<Map>()
              .map((m) => MagazineSummary.fromJson(Map<String, dynamic>.from(m)))
              .toList();
        }
      } catch (_) {}

      CourseContinueReading? cont;
      if (audience != LoginAudience.child) {
        try {
          cont = await CoursesService.continueReading();
        } catch (_) {}
      }

      final welcome = audience == LoginAudience.child &&
              childName != null &&
              childName.isNotEmpty
          ? childName
          : (me?.displayName ?? 'Reader');

      if (!mounted) return;
      setState(() {
        _audience = audience;
        _me = me;
        _welcomeName = welcome;
        _magazines = magazines;
        _continueReading = cont;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _switchUser() async {
    await AuthStorage.setShowPostLoginSetup(true);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const PostLoginSetupPage()),
    );
  }

  Future<void> _logout() async {
    await AuthStorage.clear();
    await ViewingContext.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar(
        'VidhyaVibe',
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Logout',
            onPressed: _logout,
            style: IconButton.styleFrom(foregroundColor: AuthTheme.logout),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverToBoxAdapter(child: _buildHeader()),
                    if (_audience != LoginAudience.child)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                          child: Column(
                            children: [
                              if (_continueReading != null) ...[
                                _ContinueReadingCard(
                                  item: _continueReading!,
                                  onTap: () => _openContinue(_continueReading!),
                                ),
                                const SizedBox(height: 10),
                              ],
                              _CoursesHomeCard(
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => const CoursesPage(),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(20, 8, 20, 8),
                        child: Text(
                          'Magazines',
                          style: TextStyle(
                            fontFamily: 'serif',
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AuthTheme.brown,
                          ),
                        ),
                      ),
                    ),
                    if (_magazines.isEmpty)
                      const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'No magazines to show yet.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AuthTheme.mutedBrown),
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        sliver: SliverGrid(
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: 0.72,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final mag = _magazines[index];
                              return _MagazineTile(
                                magazine: mag,
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => MagazineDetailPage(
                                        magazineId: mag.id,
                                      ),
                                    ),
                                  );
                                },
                              );
                            },
                            childCount: _magazines.length,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
      ),
    );
  }

  Future<void> _openContinue(CourseContinueReading item) async {
    try {
      final subject = await CoursesService.getSubject(item.subjectId);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CourseReaderPage(
            subjectId: item.subjectId,
            chapterId: item.chapterId,
            chapters: subject.chapters,
            initialPage: item.currentPage,
          ),
        ),
      );
      if (!mounted) return;
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Widget _buildHeader() {
    final roleLabel =
        _audience == LoginAudience.child ? 'Reading as child' : 'Reading as parent';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome, $_welcomeName',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AuthTheme.brown,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  roleLabel,
                  style: const TextStyle(
                    color: AuthTheme.mutedBrown,
                    fontSize: 13,
                  ),
                ),
                if (_me?.email != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    _me!.email,
                    style: TextStyle(
                      color: AuthTheme.mutedBrown.withValues(alpha: 0.85),
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: _switchUser,
            style: TextButton.styleFrom(
              foregroundColor: AuthTheme.green,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.swap_horiz, size: 18),
                SizedBox(width: 4),
                Text(
                  'Switch',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MagazineTile extends StatelessWidget {
  const _MagazineTile({required this.magazine, required this.onTap});

  final MagazineSummary magazine;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final resolved = ApiConfig.absoluteUrl(magazine.coverUrl);

    return Material(
      color: Colors.white.withValues(alpha: 0.85),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                child: resolved.isEmpty
                    ? Container(
                        color: AuthTheme.green.withValues(alpha: 0.12),
                        child: const Icon(
                          Icons.menu_book,
                          color: AuthTheme.green,
                          size: 40,
                        ),
                      )
                    : Image.network(
                        resolved,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: AuthTheme.green.withValues(alpha: 0.12),
                          child: const Icon(
                            Icons.menu_book,
                            color: AuthTheme.green,
                            size: 40,
                          ),
                        ),
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Text(
                magazine.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AuthTheme.brown,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContinueReadingCard extends StatelessWidget {
  const _ContinueReadingCard({required this.item, required this.onTap});

  final CourseContinueReading item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final percent = (item.percent ?? 0).clamp(0, 100);
    return Material(
      color: const Color(0xFFFFF6C8),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AuthTheme.green.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.menu_book, color: AuthTheme.green),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Continue reading',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4,
                        color: AuthTheme.mutedBrown,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.chapterTitle?.isNotEmpty == true
                          ? item.chapterTitle!
                          : 'Your last chapter',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'serif',
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AuthTheme.brown,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle.isEmpty
                          ? 'Pick up where you left off'
                          : item.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AuthTheme.mutedBrown, fontSize: 13),
                    ),
                    if (percent > 0) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: percent / 100,
                          minHeight: 6,
                          backgroundColor: const Color(0x33C4452D),
                          color: AuthTheme.green,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.play_circle_fill, color: AuthTheme.green, size: 28),
            ],
          ),
        ),
      ),
    );
  }
}

class _CoursesHomeCard extends StatelessWidget {
  const _CoursesHomeCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.88),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AuthTheme.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.school, color: AuthTheme.green),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Courses',
                      style: TextStyle(
                        fontFamily: 'serif',
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AuthTheme.brown,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'BCA, BBA and university textbooks',
                      style: TextStyle(color: AuthTheme.mutedBrown, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AuthTheme.brown),
            ],
          ),
        ),
      ),
    );
  }
}
