import 'package:flutter/material.dart';

import '../models/activity_models.dart';
import '../services/activities_service.dart';
import '../widgets/auth_widgets.dart';
import 'activity_play_page.dart';

/// Lists all activities inside a generated pack + endless regenerate.
class ActivityPackPage extends StatefulWidget {
  const ActivityPackPage({super.key, required this.pack});

  final ActivityPack pack;

  @override
  State<ActivityPackPage> createState() => _ActivityPackPageState();
}

class _ActivityPackPageState extends State<ActivityPackPage> {
  late ActivityPack _pack;
  bool _generating = false;

  @override
  void initState() {
    super.initState();
    _pack = widget.pack;
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'scientist_match':
      case 'lab_mix':
        return Icons.science;
      case 'paint_studio':
        return Icons.palette;
      case 'draw_prompt':
        return Icons.brush;
      case 'math_puzzle':
        return Icons.calculate;
      case 'word_game':
      case 'story_choice':
        return Icons.menu_book;
      case 'force_predict':
      case 'build_challenge':
        return Icons.handyman;
      default:
        return Icons.extension;
    }
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'scientist_match':
        return 'Match & react';
      case 'lab_mix':
        return 'Mix lab';
      case 'paint_studio':
        return 'Paint on screen';
      case 'draw_prompt':
        return 'Sketch on screen';
      case 'math_puzzle':
        return 'Maths puzzle';
      case 'word_game':
        return 'Word game';
      case 'story_choice':
        return 'Story choice';
      case 'force_predict':
        return 'Predict force';
      case 'build_challenge':
        return 'Build challenge';
      case 'observe_quiz':
        return 'Quick check';
      default:
        return type;
    }
  }

  Future<void> _generateAnother() async {
    if (_generating) return;
    setState(() => _generating = true);
    try {
      final result = await ActivitiesService.generatePack(
        ageGroup: _pack.ageGroup,
        subject: _pack.subject,
        difficulty: _pack.difficulty,
      );
      if (!mounted) return;
      setState(() => _pack = result.pack);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.aiEnabled
                ? 'New AI pack ready · ${result.pack.theme}'
                : 'New pack ready · ${result.pack.theme}',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          action: SnackBarAction(label: 'Retry', onPressed: _generateAnother),
        ),
      );
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  void _playFrom(int index) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ActivityPlayPage(
          activity: _pack.activities[index],
          pack: _pack,
          index: index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar(_pack.packTitle),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _pack.theme,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AuthTheme.green,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _pack.intro,
                        style: const TextStyle(
                          color: AuthTheme.mutedBrown,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '${_pack.activities.length} activities · Ages ${_pack.ageGroup} · ${_pack.difficulty}'
                        '${_pack.source == 'ai' || _pack.source == 'openai' || _pack.source == 'gemini' ? ' · AI pack' : ''}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AuthTheme.mutedBrown,
                        ),
                      ),
                      const SizedBox(height: 14),
                      AuthPrimaryButton(
                        label: 'Start learning',
                        loading: false,
                        onPressed: _pack.activities.isEmpty
                            ? null
                            : () => _playFrom(0),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ...List.generate(_pack.activities.length, (index) {
                  final activity = _pack.activities[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Material(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(14),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        leading: CircleAvatar(
                          backgroundColor:
                              AuthTheme.green.withValues(alpha: 0.15),
                          child: Icon(
                            _iconFor(activity.type),
                            color: AuthTheme.green,
                          ),
                        ),
                        title: Text(
                          activity.title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AuthTheme.brown,
                          ),
                        ),
                        subtitle: Text(
                          '${activity.badge ?? ''} · ${_typeLabel(activity.type)} · ~${activity.estimatedMinutes} min',
                        ),
                        trailing: const Icon(
                          Icons.play_arrow_rounded,
                          color: AuthTheme.green,
                        ),
                        onTap: () => _playFrom(index),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.88),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AuthTheme.green.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Never run out of learning',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AuthTheme.brown,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Each tap creates a brand-new AI pack for the same age & subject — sketch, paint, puzzles, and more.',
                        style: TextStyle(
                          color: AuthTheme.mutedBrown,
                          height: 1.4,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 12),
                      AuthPrimaryButton(
                        label: 'Generate another pack',
                        loading: _generating,
                        onPressed: _generateAnother,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (_generating)
              Container(
                color: Colors.black.withValues(alpha: 0.22),
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
                        SizedBox(height: 14),
                        Text(
                          'Creating endless learning…',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AuthTheme.brown,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
