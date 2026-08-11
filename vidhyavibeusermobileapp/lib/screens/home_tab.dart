import 'package:flutter/material.dart';

import '../config/apiConfig.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/viewing_context.dart';
import '../widgets/auth_widgets.dart';
import 'activities_page.dart';
import 'learn_hub_page.dart';
import 'login_page.dart';
import 'magazine_detail_page.dart';
import 'post_login_setup_page.dart';

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
                    SliverToBoxAdapter(child: _buildQuickActions()),
                    SliverToBoxAdapter(child: _buildLearnTeaser()),
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

  Widget _buildHeader() {
    final roleLabel =
        _audience == LoginAudience.child ? 'Reading as child' : 'Reading as parent';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
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
            style: const TextStyle(color: AuthTheme.mutedBrown, fontSize: 13),
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
    );
  }

  Widget _buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Material(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: _switchUser,
          borderRadius: BorderRadius.circular(14),
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.swap_horiz, color: AuthTheme.green, size: 20),
                SizedBox(width: 8),
                Text(
                  'Switch parent / child',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AuthTheme.brown,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLearnTeaser() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Material(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const LearnHubPage(),
              ),
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.auto_awesome, color: AuthTheme.green),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'AI Learn packs',
                        style: TextStyle(
                          fontFamily: 'serif',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AuthTheme.brown,
                        ),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: AuthTheme.mutedBrown),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sketch & paint on screen · endless AI packs by age & subject — chemistry, art, maths & more.',
                  style: TextStyle(
                    color: AuthTheme.mutedBrown,
                    fontSize: 12.5,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in const [
                      'Chemistry',
                      'Painting',
                      'Mathematics',
                      'English',
                    ])
                      ActionChip(
                        label: Text(s, style: const TextStyle(fontSize: 12)),
                        onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => LearnHubPage(
                                  initialSubject: s,
                                  autoGenerate: true,
                                ),
                              ),
                            );
                        },
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
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
