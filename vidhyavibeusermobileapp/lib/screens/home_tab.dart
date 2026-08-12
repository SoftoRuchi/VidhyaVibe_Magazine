import 'package:flutter/material.dart';

import '../config/apiConfig.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/viewing_context.dart';
import '../widgets/auth_widgets.dart';
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
