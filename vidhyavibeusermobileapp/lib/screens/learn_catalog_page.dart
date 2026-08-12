import 'package:flutter/material.dart';

import '../models/learn_activity_models.dart';
import '../services/learn_activities_service.dart';
import '../services/viewing_context.dart';
import '../services/api_client.dart';
import '../widgets/auth_widgets.dart';
import 'learn_play_page.dart';

/// Admin-configured activities catalog (age + subject filtered).
class LearnCatalogPage extends StatefulWidget {
  const LearnCatalogPage({super.key});

  @override
  State<LearnCatalogPage> createState() => _LearnCatalogPageState();
}

class _LearnCatalogPageState extends State<LearnCatalogPage> {
  bool _loading = true;
  String? _error;
  List<LearnActivitySummary> _items = [];
  List<LearnSubject> _subjects = [];
  String? _subjectSlug;
  String _ageBand = '11-13';
  int _walletBalance = 0;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _resolveAgeBand();
      final subjects = await LearnActivitiesService.subjects();
      final items = await LearnActivitiesService.list(
        ageBand: _ageBand,
        subjectSlug: _subjectSlug,
      );
      var wallet = 0;
      try {
        wallet = await LearnActivitiesService.walletBalance();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _subjects = subjects;
        _items = items;
        _walletBalance = wallet;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().contains('TimeoutException')
            ? 'Server is taking too long to respond. Pull to refresh or try again.'
            : e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _resolveAgeBand() async {
    try {
      if (!await ViewingContext.isChildAudience()) return;
      final readersRes = await ApiClient.listReaders();
      if (!ApiClient.isOk(readersRes)) return;
      final readerId = await ViewingContext.getSelectedReaderId();
      final list = ApiClient.decodeList(readersRes).whereType<Map>();
      Map? match;
      for (final r in list) {
        if (readerId != null && '${r['id']}' == '$readerId') {
          match = r;
          break;
        }
      }
      match ??= list.isNotEmpty ? list.first : null;
      final age = match?['age'];
      final n = age is int ? age : int.tryParse('$age');
      if (n == null) return;
      if (n <= 10) {
        _ageBand = '8-10';
      } else if (n <= 13) {
        _ageBand = '11-13';
      } else if (n <= 16) {
        _ageBand = '14-16';
      } else {
        _ageBand = '17+';
      }
    } catch (_) {}
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      final items = await LearnActivitiesService.list(
        ageBand: _ageBand,
        subjectSlug: _subjectSlug,
      );
      var wallet = _walletBalance;
      try {
        wallet = await LearnActivitiesService.walletBalance();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _items = items;
        _walletBalance = wallet;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().contains('TimeoutException')
            ? 'Server is taking too long to respond. Pull to refresh or try again.'
            : e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'COMPLETED':
        return AuthTheme.green;
      case 'IN_PROGRESS':
        return Colors.orange.shade700;
      default:
        return AuthTheme.mutedBrown;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Activities for ages $_ageBand',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AuthTheme.brown,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AuthTheme.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Wallet $_walletBalance pts',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AuthTheme.green,
                    fontSize: 12.5,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: _ageBand,
                underline: const SizedBox.shrink(),
                items: const [
                  DropdownMenuItem(value: '8-10', child: Text('8–10')),
                  DropdownMenuItem(value: '11-13', child: Text('11–13')),
                  DropdownMenuItem(value: '14-16', child: Text('14–16')),
                  DropdownMenuItem(value: '17+', child: Text('17+')),
                ],
                onChanged: (v) {
                  if (v == null) return;
                  setState(() => _ageBand = v);
                  _reload();
                },
              ),
            ],
          ),
        ),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: [
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: const Text('All'),
                  selected: _subjectSlug == null,
                  onSelected: (_) {
                    setState(() => _subjectSlug = null);
                    _reload();
                  },
                ),
              ),
              ..._subjects.map(
                (s) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(s.name),
                    selected: _subjectSlug == s.slug,
                    onSelected: (_) {
                      setState(() => _subjectSlug = s.slug);
                      _reload();
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 12),
                            AuthPrimaryButton(
                              label: 'Retry',
                              loading: false,
                              onPressed: _bootstrap,
                            ),
                          ],
                        ),
                      ),
                    )
                  : _items.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'No new activities right now.\nCompleted ones stay in your wallet points — keep learning!',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: AuthTheme.mutedBrown),
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _reload,
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                            itemCount: _items.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              final a = _items[i];
                              return Material(
                                color: Colors.white.withValues(alpha: 0.92),
                                borderRadius: BorderRadius.circular(14),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 8,
                                  ),
                                  title: Text(
                                    a.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AuthTheme.brown,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${a.subjectName ?? 'Learn'} · ${a.activityType} · ${a.difficulty} · ~${a.estimatedMinutes} min · +${a.points} pts',
                                  ),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.play_circle_fill,
                                        color: AuthTheme.green,
                                      ),
                                      Text(
                                        a.progressStatus == 'COMPLETED'
                                            ? 'Done'
                                            : a.progressStatus == 'IN_PROGRESS'
                                                ? 'Resume'
                                                : 'Start',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: _statusColor(a.progressStatus),
                                        ),
                                      ),
                                    ],
                                  ),
                                  onTap: () async {
                                    await Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            LearnPlayPage(activityId: a.id),
                                      ),
                                    );
                                    _reload();
                                  },
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }
}
