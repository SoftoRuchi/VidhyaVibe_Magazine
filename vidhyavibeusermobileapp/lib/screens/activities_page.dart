import 'package:flutter/material.dart';

import '../services/activities_service.dart';
import '../services/viewing_context.dart';
import '../services/api_client.dart';
import '../widgets/auth_widgets.dart';
import 'activity_pack_page.dart';

/// AI activity packs (generative). Catalog lives in LearnHubPage tab 0.
class ActivitiesPage extends StatefulWidget {
  const ActivitiesPage({
    super.key,
    this.initialSubject,
    this.autoGenerate = false,
  });

  final String? initialSubject;
  final bool autoGenerate;

  @override
  State<ActivitiesPage> createState() => _ActivitiesPageState();
}

class _ActivitiesPageState extends State<ActivitiesPage> {
  static const _fallbackAgeGroups = ['8-10', '11-13', '14-16', '17-21'];
  static const _fallbackSubjects = [
    'Chemistry',
    'Physics',
    'Mathematics',
    'English',
    'Hindi',
    'Drawing',
    'Painting',
    'DIY',
    'Biology',
  ];
  static const _fallbackDifficulties = ['Easy', 'Medium', 'Hard'];

  List<String> _ageGroups = List.from(_fallbackAgeGroups);
  List<String> _subjects = List.from(_fallbackSubjects);
  List<String> _difficulties = List.from(_fallbackDifficulties);

  String _ageGroup = '11-13';
  String _subject = 'Chemistry';
  String _difficulty = 'Easy';
  bool _loading = false;
  bool _metaLoading = true;
  String? _status;
  bool _aiOnline = true;

  @override
  void initState() {
    super.initState();
    if (widget.initialSubject != null && widget.initialSubject!.isNotEmpty) {
      _subject = widget.initialSubject!;
    }
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await Future.wait([_loadMeta(), _preferChildAge()]);
    if (!mounted) return;
    setState(() => _metaLoading = false);
    if (widget.autoGenerate) {
      await _generate();
    }
  }

  Future<void> _loadMeta() async {
    try {
      final res = await ApiClient.activitiesMeta();
      if (!ApiClient.isOk(res)) return;
      final data = ApiClient.decodeMap(res);
      final ages = (data['ageGroups'] is List)
          ? (data['ageGroups'] as List)
              .whereType<Map>()
              .map((e) => e['id']?.toString() ?? '')
              .where((e) => e.isNotEmpty)
              .toList()
          : <String>[];
      final subjects = (data['subjects'] is List)
          ? (data['subjects'] as List)
              .whereType<Map>()
              .map((e) => e['id']?.toString() ?? '')
              .where((e) => e.isNotEmpty)
              .toList()
          : <String>[];
      final diffs = (data['difficulties'] is List)
          ? (data['difficulties'] as List)
              .whereType<Map>()
              .map((e) => e['id']?.toString() ?? '')
              .where((e) => e.isNotEmpty)
              .toList()
          : <String>[];
      if (!mounted) return;
      setState(() {
        if (ages.isNotEmpty) {
          _ageGroups = ages;
          if (!_ageGroups.contains(_ageGroup)) _ageGroup = _ageGroups.first;
        }
        if (subjects.isNotEmpty) {
          _subjects = subjects;
          if (!_subjects.contains(_subject)) {
            _subject = widget.initialSubject != null &&
                    _subjects.contains(widget.initialSubject)
                ? widget.initialSubject!
                : _subjects.first;
          }
        }
        if (diffs.isNotEmpty) {
          _difficulties = diffs;
          if (!_difficulties.contains(_difficulty)) {
            _difficulty = _difficulties.first;
          }
        }
      });
    } catch (_) {
      // keep fallbacks
    }
  }

  Future<void> _preferChildAge() async {
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
      if (n == null || !mounted) return;
      setState(() {
        if (n <= 10) {
          _ageGroup = '8-10';
        } else if (n <= 13) {
          _ageGroup = '11-13';
        } else if (n <= 16) {
          _ageGroup = '14-16';
        } else {
          _ageGroup = '17-21';
        }
      });
    } catch (_) {}
  }

  Future<void> _generate() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _status = 'Creating a unique AI activity pack…';
    });
    try {
      final result = await ActivitiesService.generatePack(
        ageGroup: _ageGroup,
        subject: _subject,
        difficulty: _difficulty,
      );
      if (!mounted) return;
      setState(() {
        _aiOnline = result.aiEnabled;
        _status =
            '${result.pack.activities.length} AI activities · ${result.pack.theme}';
      });
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ActivityPackPage(pack: result.pack),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          action: SnackBarAction(label: 'Retry', onPressed: _generate),
        ),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _metaLoading
        ? const Center(child: CircularProgressIndicator())
        : Stack(
                children: [
                  ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                    children: [
                      _heroCard(),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: _ageGroups.contains(_ageGroup)
                            ? _ageGroup
                            : _ageGroups.first,
                        decoration:
                            AuthTheme.fieldDecoration(label: 'Age group'),
                        items: _ageGroups
                            .map(
                              (g) => DropdownMenuItem(
                                value: g,
                                child: Text('Ages $g'),
                              ),
                            )
                            .toList(),
                        onChanged: _loading
                            ? null
                            : (v) {
                                if (v != null) setState(() => _ageGroup = v);
                              },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: _subjects.contains(_subject)
                            ? _subject
                            : _subjects.first,
                        decoration: AuthTheme.fieldDecoration(label: 'Subject'),
                        items: _subjects
                            .map(
                              (s) => DropdownMenuItem(
                                value: s,
                                child: Text(s),
                              ),
                            )
                            .toList(),
                        onChanged: _loading
                            ? null
                            : (v) {
                                if (v != null) setState(() => _subject = v);
                              },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: _difficulties.contains(_difficulty)
                            ? _difficulty
                            : _difficulties.first,
                        decoration:
                            AuthTheme.fieldDecoration(label: 'Difficulty'),
                        items: _difficulties
                            .map(
                              (d) => DropdownMenuItem(
                                value: d,
                                child: Text(d),
                              ),
                            )
                            .toList(),
                        onChanged: _loading
                            ? null
                            : (v) {
                                if (v != null) {
                                  setState(() => _difficulty = v);
                                }
                              },
                      ),
                      const SizedBox(height: 18),
                      AuthPrimaryButton(
                        label: 'Generate AI activity pack',
                        loading: _loading,
                        onPressed: _generate,
                      ),
                      if (_status != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          _status!,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: _aiOnline
                                ? AuthTheme.green
                                : AuthTheme.mutedBrown,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),
                      const Text(
                        'Quick start by subject',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: AuthTheme.brown,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Tap a subject to generate a fresh AI pack instantly.',
                        style: TextStyle(
                          color: AuthTheme.mutedBrown,
                          fontSize: 12.5,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _subjects.map((s) {
                          final selected = s == _subject;
                          return ActionChip(
                            label: Text(s),
                            backgroundColor: selected
                                ? AuthTheme.green.withValues(alpha: 0.18)
                                : Colors.white.withValues(alpha: 0.9),
                            side: BorderSide(
                              color: selected
                                  ? AuthTheme.green
                                  : AuthTheme.brown.withValues(alpha: 0.15),
                            ),
                            onPressed: _loading
                                ? null
                                : () async {
                                    setState(() => _subject = s);
                                    await _generate();
                                  },
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                  if (_loading)
                    Container(
                      color: Colors.black.withValues(alpha: 0.25),
                      child: Center(
                        child: Container(
                          margin: const EdgeInsets.all(28),
                          padding: const EdgeInsets.all(22),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(),
                              SizedBox(height: 16),
                              Text(
                                'AI is designing your activity pack…',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AuthTheme.brown,
                                ),
                              ),
                              SizedBox(height: 6),
                              Text(
                                'Unique games for this age & subject.\nThis can take up to a minute.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: AuthTheme.mutedBrown,
                                  fontSize: 12.5,
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              );
  }

  Widget _heroCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.12)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'AI activity packs',
            style: TextStyle(
              fontFamily: 'serif',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AuthTheme.brown,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Each tap creates a fresh AI pack — sketch & paint on screen, '
            'match reactions, solve puzzles, then generate again for endless learning. '
            'Kids learn better by creating, not only reading.',
            style: TextStyle(
              color: AuthTheme.mutedBrown,
              height: 1.45,
              fontSize: 13.5,
            ),
          ),
        ],
      ),
    );
  }
}
