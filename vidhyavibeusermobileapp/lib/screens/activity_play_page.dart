import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/activity_models.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/sketch_canvas.dart';

class ActivityPlayPage extends StatefulWidget {
  const ActivityPlayPage({
    super.key,
    required this.activity,
    this.pack,
    this.index = 0,
  });

  final PackActivity activity;
  final ActivityPack? pack;
  final int index;

  @override
  State<ActivityPlayPage> createState() => _ActivityPlayPageState();
}

class _ActivityPlayPageState extends State<ActivityPlayPage>
    with SingleTickerProviderStateMixin {
  PackActivity get a => widget.activity;

  final Set<String> _selectedItemIds = {};
  final Set<String> _selectedColourIds = {};
  final GlobalKey<SketchCanvasState> _sketchKey = GlobalKey<SketchCanvasState>();
  int _sketchStrokes = 0;
  int? _choiceIndex;
  bool _revealed = false;
  bool _success = false;
  late AnimationController _bubbleCtrl;

  @override
  void initState() {
    super.initState();
    _bubbleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
  }

  @override
  void dispose() {
    _bubbleCtrl.dispose();
    super.dispose();
  }

  void _toggleItem(String id) {
    if (_revealed) return;
    setState(() {
      if (_selectedItemIds.contains(id)) {
        _selectedItemIds.remove(id);
      } else {
        if (_selectedItemIds.length >= 2) {
          _selectedItemIds.remove(_selectedItemIds.first);
        }
        _selectedItemIds.add(id);
      }
    });
    if (_selectedItemIds.length == 2) {
      _checkPair();
    }
  }

  void _checkPair() {
    final pair = a.correctPair.toSet();
    final ok = pair.length == 2 &&
        _selectedItemIds.length == 2 &&
        _selectedItemIds.containsAll(pair);
    setState(() {
      _revealed = true;
      _success = ok;
    });
    if (ok) {
      _bubbleCtrl.forward(from: 0);
    }
  }

  void _pickChoice(int index, {required int correct}) {
    if (_revealed) return;
    setState(() {
      _choiceIndex = index;
      _revealed = true;
      _success = index == correct;
    });
  }

  bool get _hasNext {
    final pack = widget.pack;
    if (pack == null) return false;
    return widget.index + 1 < pack.activities.length;
  }

  void _finish({String? message}) {
    final msg = message ?? a.learningBite ?? 'Great work — keep exploring!';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

    if (_hasNext) {
      final next = widget.pack!.activities[widget.index + 1];
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ActivityPlayPage(
            activity: next,
            pack: widget.pack,
            index: widget.index + 1,
          ),
        ),
      );
      return;
    }
    Navigator.pop(context, true);
  }

  Color _parseHex(String hex) {
    var h = hex.replaceAll('#', '');
    if (h.length == 6) h = 'FF$h';
    final v = int.tryParse(h, radix: 16) ?? 0xFF888888;
    return Color(v);
  }

  @override
  Widget build(BuildContext context) {
    final pack = widget.pack;
    final progress = pack == null
        ? null
        : 'Activity ${widget.index + 1} of ${pack.activities.length}';

    return Scaffold(
      appBar: AuthTheme.buildAppBar(a.title),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            if (progress != null) ...[
              Text(
                progress,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AuthTheme.green,
                  fontSize: 12.5,
                ),
              ),
              const SizedBox(height: 6),
            ],
            if (a.badge != null)
              Text(
                a.badge!,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AuthTheme.green,
                ),
              ),
            const SizedBox(height: 6),
            Text(
              a.intro,
              style: const TextStyle(
                color: AuthTheme.mutedBrown,
                height: 1.4,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            ..._buildByType(),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildByType() {
    switch (a.type) {
      case 'scientist_match':
      case 'lab_mix':
        return _matchUi();
      case 'paint_studio':
        return _paintUi();
      case 'draw_prompt':
        return _drawUi();
      case 'math_puzzle':
        return _choiceUi(
          prompt: a.puzzle ?? a.intro,
          choices: a.choices,
          correct: a.answerIndex ?? 0,
          explain: a.explanation,
        );
      case 'word_game':
      case 'story_choice':
        return _choiceUi(
          prompt: a.question ?? a.intro,
          choices: a.questionOptions.isNotEmpty ? a.questionOptions : a.choices,
          correct: a.questionAnswerIndex ?? a.answerIndex ?? 0,
          explain: a.explanation ?? a.learningBite,
        );
      case 'force_predict':
      case 'build_challenge':
      case 'observe_quiz':
        return _choiceUi(
          prompt: a.setup ?? a.question ?? a.intro,
          choices: a.options.isNotEmpty
              ? a.options
              : (a.questionOptions.isNotEmpty ? a.questionOptions : a.choices),
          correct: a.correctOptionIndex ??
              a.questionAnswerIndex ??
              a.answerIndex ??
              0,
          explain: a.explanation ?? a.learningBite,
        );
      default:
        return _choiceUi(
          prompt: a.question ?? a.intro,
          choices: a.questionOptions.isNotEmpty ? a.questionOptions : a.choices,
          correct: a.questionAnswerIndex ?? a.answerIndex ?? 0,
          explain: a.learningBite,
        );
    }
  }

  List<Widget> _matchUi() {
    return [
      Wrap(
        spacing: 10,
        runSpacing: 10,
        children: a.items.map((item) {
          final selected = _selectedItemIds.contains(item.id);
          return InkWell(
            onTap: () => _toggleItem(item.id),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 100,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: selected
                      ? AuthTheme.green
                      : AuthTheme.brown.withValues(alpha: 0.15),
                  width: selected ? 2.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  Text(item.emoji, style: const TextStyle(fontSize: 28)),
                  const SizedBox(height: 6),
                  Text(
                    item.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
      const SizedBox(height: 12),
      Text(
        _revealed
            ? (_success
                ? '${a.reactionEmoji ?? '✨'} ${a.reactionTitle ?? 'It reacts!'}'
                : (a.wrongPairHint ?? 'Try another pair'))
            : 'Pick two items that belong together',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: _revealed && _success ? AuthTheme.green : AuthTheme.brown,
        ),
      ),
      if (_revealed && _success) ...[
        const SizedBox(height: 8),
        if (a.reactionExplain != null)
          Text(a.reactionExplain!, style: const TextStyle(height: 1.4)),
        if (a.whatIsMade != null) ...[
          const SizedBox(height: 6),
          Text(
            'What forms: ${a.whatIsMade}',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
        const SizedBox(height: 10),
        _bubbleBurst(),
        if (a.learningBite != null) ...[
          const SizedBox(height: 8),
          _card('Learning bite', Text(a.learningBite!)),
        ],
        if (a.safetyTips.isNotEmpty) ...[
          const SizedBox(height: 8),
          _card(
            'Safety',
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: a.safetyTips.map((t) => Text('• $t')).toList(),
            ),
          ),
        ],
        const SizedBox(height: 16),
        AuthPrimaryButton(
          label: _hasNext ? 'Next activity' : 'Finish pack',
          loading: false,
          onPressed: () => _finish(),
        ),
      ],
      if (_revealed && !_success) ...[
        const SizedBox(height: 12),
        TextButton(
          onPressed: () {
            setState(() {
              _selectedItemIds.clear();
              _revealed = false;
              _success = false;
            });
          },
          child: const Text('Try again'),
        ),
      ],
    ];
  }

  Widget _bubbleBurst() {
    return SizedBox(
      height: 90,
      child: AnimatedBuilder(
        animation: _bubbleCtrl,
        builder: (context, _) {
          return CustomPaint(
            painter: _BubblePainter(progress: _bubbleCtrl.value),
            child: const SizedBox.expand(),
          );
        },
      ),
    );
  }

  List<Widget> _paintUi() {
    final palette = a.colours.map((c) => _parseHex(c.hex)).toList();
    return [
      if (a.targetScene != null)
        _card(
          'Your scene',
          Text(a.targetScene!, style: const TextStyle(height: 1.4)),
        ),
      const SizedBox(height: 12),
      if (a.colours.isNotEmpty)
        _card(
          'Suggested palette',
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: a.colours.map((c) {
              final selected = _selectedColourIds.contains(c.id);
              final color = _parseHex(c.hex);
              return InkWell(
                onTap: () {
                  setState(() {
                    if (selected) {
                      _selectedColourIds.remove(c.id);
                    } else {
                      _selectedColourIds.add(c.id);
                    }
                  });
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: 92,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? AuthTheme.green
                          : color.withValues(alpha: 0.5),
                      width: selected ? 2.5 : 1,
                    ),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.black12),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        c.name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      if (a.paintSteps.isNotEmpty) ...[
        const SizedBox(height: 12),
        _card(
          'Steps',
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < a.paintSteps.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: AuthTheme.green,
                        child: Text(
                          '${i + 1}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(child: Text(a.paintSteps[i])),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
      const SizedBox(height: 12),
      _card(
        'Paint on screen',
        SketchCanvas(
          key: _sketchKey,
          palette: palette.isNotEmpty ? palette : const [],
          height: 340,
          onStrokeCountChanged: (n) => setState(() => _sketchStrokes = n),
        ),
      ),
      if (a.funFact != null) ...[
        const SizedBox(height: 12),
        _card('Fun fact', Text(a.funFact!)),
      ],
      const SizedBox(height: 16),
      AuthPrimaryButton(
        label: _sketchStrokes == 0
            ? 'Sketch something first'
            : (_hasNext ? 'Save & next activity' : 'Save my painting'),
        loading: false,
        onPressed: _sketchStrokes == 0
            ? null
            : () => _finish(
                  message: a.learningBite ??
                      'Beautiful work — colour tells a story!',
                ),
      ),
    ];
  }

  List<Widget> _drawUi() {
    return [
      _card(
        'Draw this',
        Text(
          a.drawPrompt ?? a.intro,
          style: const TextStyle(height: 1.4, fontSize: 16),
        ),
      ),
      if (a.drawTips.isNotEmpty) ...[
        const SizedBox(height: 12),
        _card(
          'Tips',
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: a.drawTips.map((t) => Text('• $t')).toList(),
          ),
        ),
      ],
      const SizedBox(height: 12),
      _card(
        'Your sketch pad',
        SketchCanvas(
          key: _sketchKey,
          height: 360,
          onStrokeCountChanged: (n) => setState(() => _sketchStrokes = n),
        ),
      ),
      const SizedBox(height: 16),
      AuthPrimaryButton(
        label: _sketchStrokes == 0
            ? 'Draw with your finger first'
            : (_hasNext ? 'Save sketch & next' : 'I finished my sketch'),
        loading: false,
        onPressed: _sketchStrokes == 0
            ? null
            : () => _finish(
                  message: a.learningBite ?? 'Great observation!',
                ),
      ),
    ];
  }

  List<Widget> _choiceUi({
    required String prompt,
    required List<String> choices,
    required int correct,
    String? explain,
  }) {
    if (choices.isEmpty) {
      return [
        _card('Activity', Text(prompt)),
        const SizedBox(height: 12),
        AuthPrimaryButton(
          label: _hasNext ? 'Next activity' : 'Done',
          loading: false,
          onPressed: () => _finish(),
        ),
      ];
    }
    return [
      _card(
        prompt,
        Column(
          children: [
            for (var i = 0; i < choices.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: _choiceColor(i, correct),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: () => _pickChoice(i, correct: correct),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Text(
                            String.fromCharCode(65 + i),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(choices[i])),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            if (_revealed) ...[
              const SizedBox(height: 8),
              Text(
                explain ?? (a.learningBite ?? ''),
                style: const TextStyle(height: 1.4, color: AuthTheme.mutedBrown),
              ),
              const SizedBox(height: 12),
              AuthPrimaryButton(
                label: _hasNext ? 'Next activity' : 'Finish pack',
                loading: false,
                onPressed: () => _finish(),
              ),
            ],
          ],
        ),
      ),
    ];
  }

  Color _choiceColor(int i, int correct) {
    if (!_revealed) {
      return _choiceIndex == i
          ? AuthTheme.green.withValues(alpha: 0.15)
          : AuthTheme.brown.withValues(alpha: 0.06);
    }
    if (i == correct) return AuthTheme.green.withValues(alpha: 0.22);
    if (i == _choiceIndex) return AuthTheme.logout.withValues(alpha: 0.16);
    return AuthTheme.brown.withValues(alpha: 0.05);
  }

  Widget _card(String title, Widget child) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: AuthTheme.brown,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _BubblePainter extends CustomPainter {
  _BubblePainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF5FA8D3).withValues(alpha: 0.55);
    final rnd = math.Random(7);
    for (var i = 0; i < 14; i++) {
      final x = rnd.nextDouble() * size.width;
      final y = size.height * (1 - progress) - rnd.nextDouble() * 20;
      final r = 4 + rnd.nextDouble() * 10 * progress;
      canvas.drawCircle(Offset(x, y), r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _BubblePainter oldDelegate) =>
      oldDelegate.progress != progress;
}
