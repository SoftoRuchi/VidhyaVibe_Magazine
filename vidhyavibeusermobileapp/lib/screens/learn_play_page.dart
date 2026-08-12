import 'package:flutter/material.dart';

import '../models/learn_activity_models.dart';
import '../services/learn_activities_service.dart';
import '../services/viewing_context.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/sketch_canvas.dart';

class LearnPlayPage extends StatefulWidget {
  const LearnPlayPage({super.key, required this.activityId});

  final int activityId;

  @override
  State<LearnPlayPage> createState() => _LearnPlayPageState();
}

class _LearnPlayPageState extends State<LearnPlayPage> {
  bool _loading = true;
  String? _error;
  LearnActivityDetail? _activity;
  LearnCompleteResult? _result;
  bool _submitting = false;
  DateTime? _startedAt;
  int _walletBalance = 0;

  // shared interaction state
  final List<String> _connectSeq = [];
  Offset? _connectFinger;
  final Map<String, String> _placements = {};
  final Map<String, String> _matches = {};
  List<String> _order = [];
  int? _selectedIndex;
  String? _selectedId;
  final GlobalKey<SketchCanvasState> _sketchKey = GlobalKey();
  int _strokes = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final detail = await LearnActivitiesService.getById(widget.activityId);
      final readerId = await ViewingContext.getSelectedReaderId();
      try {
        _walletBalance = await LearnActivitiesService.walletBalance();
      } catch (_) {}
      await LearnActivitiesService.start(widget.activityId, readerId: readerId);
      final cfg = detail.config;
      if (detail.activityType == 'ARRANGE_ORDER') {
        final items = (cfg['items'] is List) ? cfg['items'] as List : [];
        _order = items.map((e) => (e is Map ? e['id'] : e).toString()).toList()
          ..shuffle();
      }
      if (!mounted) return;
      setState(() {
        _activity = detail;
        _loading = false;
        _startedAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (msg.contains('already_completed') ||
          msg.toLowerCase().contains('already completed')) {
        setState(() {
          _loading = false;
          _error = 'You already completed this activity.';
        });
        return;
      }
      setState(() {
        _loading = false;
        _error = msg;
      });
    }
  }

  Map<String, dynamic> _buildResponse() {
    final type = _activity!.activityType;
    switch (type) {
      case 'CONNECT_DOTS':
        return {'sequence': List<String>.from(_connectSeq)};
      case 'PAINT':
        return {
          'completed': _strokes > 0,
          'completionPercent': _strokes >= 3 ? 80 : (_strokes > 0 ? 40 : 0),
        };
      case 'DRAG_DROP':
      case 'SORTING':
        return {
          'placements': Map<String, String>.from(_placements),
          'sorts': Map<String, String>.from(_placements),
        };
      case 'MATCHING':
        return {'matches': Map<String, String>.from(_matches)};
      case 'ARRANGE_ORDER':
        return {'order': List<String>.from(_order)};
      case 'TAP_CORRECT':
        return {
          'selectedOptionId': _selectedId,
          'selectedIndex': _selectedIndex,
        };
      case 'FINANCIAL_DECISION':
        return {
          'selectedChoiceId': _selectedId,
          'selectedIndex': _selectedIndex,
        };
      default:
        return {
          'selectedIndex': _selectedIndex,
          'answers': [
            {'selectedIndex': _selectedIndex, 'selectedOptionId': _selectedId},
          ],
        };
    }
  }

  Future<void> _submit() async {
    if (_activity == null || _submitting) return;

    if (_activity!.activityType == 'CONNECT_DOTS') {
      final cfg = _activity!.config;
      final dots = (cfg['dots'] is List) ? List.from(cfg['dots'] as List) : [];
      final expected = _connectExpectedIds(cfg);
      _appendStackedConnectIds(dots, expected);
      if (_connectSeq.length < expected.length) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Connect all dots in order (${_connectSeq.length}/${expected.length}).',
            ),
          ),
        );
        return;
      }
    }

    setState(() => _submitting = true);
    try {
      final readerId = await ViewingContext.getSelectedReaderId();
      final spent = _startedAt == null
          ? null
          : DateTime.now().difference(_startedAt!).inSeconds;
      final result = await LearnActivitiesService.complete(
        widget.activityId,
        response: _buildResponse(),
        readerId: readerId,
        timeSpentSec: spent,
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        if (result.walletBalance != null) {
          _walletBalance = result.walletBalance!;
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _reset() {
    setState(() {
      _result = null;
      _connectSeq.clear();
      _connectFinger = null;
      _placements.clear();
      _matches.clear();
      _selectedIndex = null;
      _selectedId = null;
      _strokes = 0;
      _sketchKey.currentState?.clear();
      final cfg = _activity?.config ?? {};
      if (_activity?.activityType == 'ARRANGE_ORDER') {
        final items = (cfg['items'] is List) ? cfg['items'] as List : [];
        _order = items.map((e) => (e is Map ? e['id'] : e).toString()).toList()
          ..shuffle();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AuthTheme.buildAppBar('Activity'),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null || _activity == null) {
      return Scaffold(
        appBar: AuthTheme.buildAppBar('Activity'),
        body: Center(child: Text(_error ?? 'Not found')),
      );
    }

    final a = _activity!;
    final isConnect = a.activityType == 'CONNECT_DOTS' && _result == null;
    final header = <Widget>[
      Text(
        '${a.subjectName ?? 'Learn'} · ${a.activityType} · ${a.difficulty}',
        style: const TextStyle(
          color: AuthTheme.green,
          fontWeight: FontWeight.w700,
          fontSize: 12.5,
        ),
      ),
      if (a.instructions != null && a.instructions!.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text(
          a.instructions!,
          style: const TextStyle(color: AuthTheme.mutedBrown, height: 1.4),
        ),
      ],
      const SizedBox(height: 12),
    ];

    final footer = <Widget>[
      if (_result == null) ...[
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _reset,
                child: const Text('Reset'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: AuthPrimaryButton(
                label: 'Complete',
                loading: _submitting,
                onPressed: _submit,
              ),
            ),
          ],
        ),
      ] else ...[
        const SizedBox(height: 12),
        AuthPrimaryButton(
          label: 'Try again',
          loading: false,
          onPressed: _reset,
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Back to list'),
        ),
      ],
    ];

    return Scaffold(
      appBar: AuthTheme.buildAppBar(a.title),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: isConnect
            ? Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ...header,
                    Expanded(
                      flex: 7,
                      child: Column(children: _player(a)),
                    ),
                    ...footer,
                    const Spacer(flex: 2),
                  ],
                ),
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  ...header,
                  if (_result != null) _resultCard(_result!) else ..._player(a),
                  ...footer,
                ],
              ),
      ),
    );
  }

  Widget _resultCard(LearnCompleteResult r) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            r.appreciation ?? '⭐ Excellent Work!',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AuthTheme.brown,
            ),
          ),
          const SizedBox(height: 8),
          Text(r.resultMessage, style: const TextStyle(height: 1.4)),
          const SizedBox(height: 10),
          Text(
            '+${r.pointsEarned} points · Score ${r.score}',
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: AuthTheme.green,
            ),
          ),
          if (r.pointsCredited > 0) ...[
            const SizedBox(height: 6),
            Text(
              'Wallet +${r.pointsCredited} pts'
              '${r.walletBalance != null ? ' · Balance ${r.walletBalance} pts' : ''}',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AuthTheme.brown,
              ),
            ),
          ],
          if (r.walletSpent > 0) ...[
            const SizedBox(height: 4),
            Text(
              'Spent ${r.walletSpent} pts from wallet'
              '${r.walletBalance != null ? ' · Balance ${r.walletBalance} pts' : ''}',
              style: const TextStyle(color: AuthTheme.mutedBrown),
            ),
          ],
          const SizedBox(height: 12),
          const Text(
            'What did you learn?',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            r.explanation,
            style: const TextStyle(color: AuthTheme.mutedBrown, height: 1.4),
          ),
        ],
      ),
    );
  }

  List<Widget> _player(LearnActivityDetail a) {
    switch (a.activityType) {
      case 'CONNECT_DOTS':
        return _connectDots(a.config);
      case 'PAINT':
        return _paint(a.config);
      case 'DRAG_DROP':
        return _dragDrop(a.config);
      case 'MATCHING':
        return _matching(a.config);
      case 'SORTING':
        return _sorting(a.config);
      case 'ARRANGE_ORDER':
        return _arrange(a.config);
      case 'TAP_CORRECT':
        return _tapCorrect(a.config);
      case 'FINANCIAL_DECISION':
        return _financial(a.config);
      default:
        return _quiz(a.config);
    }
  }

  List<Widget> _connectDots(Map<String, dynamic> cfg) {
    final dots = (cfg['dots'] is List) ? List.from(cfg['dots'] as List) : [];

    return [
      Expanded(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
          child: Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFFF7F1E8),
              borderRadius: BorderRadius.circular(16),
              border:
                  Border.all(color: AuthTheme.brown.withValues(alpha: 0.15)),
            ),
            child: LayoutBuilder(
            builder: (context, box) {
              final radius = _connectDotRadius(
                box.maxWidth < box.maxHeight ? box.maxWidth : box.maxHeight,
                dots.length,
              );
              final pad = radius + 8;
              final hitRadius = radius * 1.55;

              void handlePoint(Offset local, {required bool allowUndo}) {
                final hit = _hitConnectDot(
                  local,
                  dots,
                  box.maxWidth,
                  box.maxHeight,
                  pad,
                  hitRadius,
                );
                if (hit == null) return;

                final expected = _connectExpectedIds(cfg);

                // If several ids share this spot, pick the next unfinished sequence id.
                String tapId = '${hit['id'] ?? ''}';
                if (expected.isNotEmpty) {
                  for (final id in expected) {
                    if (_connectSeq.contains(id)) continue;
                    final d = _dotById(dots, id);
                    if (d != null && _sameConnectPos(hit, d)) {
                      tapId = id;
                      break;
                    }
                  }
                }
                if (tapId.isEmpty) return;

                if (allowUndo &&
                    _connectSeq.isNotEmpty &&
                    _connectSeq.last == tapId) {
                  setState(() {
                    _connectSeq.removeLast();
                    _connectFinger = local;
                  });
                  return;
                }

                if (_connectSeq.contains(tapId)) return;
                setState(() {
                  _connectSeq.add(tapId);
                  _appendStackedConnectIds(dots, expected);
                  _connectFinger = local;
                });
              }

              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapUp: (d) => handlePoint(d.localPosition, allowUndo: true),
                onPanStart: (d) {
                  setState(() => _connectFinger = d.localPosition);
                  handlePoint(d.localPosition, allowUndo: false);
                },
                onPanUpdate: (d) {
                  setState(() => _connectFinger = d.localPosition);
                  handlePoint(d.localPosition, allowUndo: false);
                },
                onPanEnd: (_) => setState(() => _connectFinger = null),
                onPanCancel: () => setState(() => _connectFinger = null),
                child: Stack(
                  children: [
                    CustomPaint(
                      size: Size(box.maxWidth, box.maxHeight),
                      painter: _ConnectPainter(
                        dots: dots,
                        sequence: _connectSeq,
                        width: box.maxWidth,
                        height: box.maxHeight,
                        pad: pad,
                        strokeWidth: (radius * 0.32).clamp(2.0, 3.5),
                        finger: _connectFinger,
                      ),
                    ),
                    ..._visibleConnectDots(dots).map((d) {
                      final id = '${d['id'] ?? ''}';
                      final label = '${d['label'] ?? id}';
                      final selected = _connectSeq.contains(id);
                      final pos = _connectDotOffset(
                        d,
                        box.maxWidth,
                        box.maxHeight,
                        pad,
                      );
                      return Positioned(
                        left: pos.dx - radius,
                        top: pos.dy - radius,
                        child: IgnorePointer(
                          child: Container(
                            width: radius * 2,
                            height: radius * 2,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color:
                                  selected ? AuthTheme.green : Colors.white,
                              border: Border.all(
                                color: selected
                                    ? AuthTheme.green
                                    : AuthTheme.brown.withValues(alpha: 0.35),
                                width: 1.1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.07),
                                  blurRadius: 2,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                fontSize: (radius * 0.9).clamp(8.0, 12.0),
                                fontWeight: FontWeight.w800,
                                color: selected
                                    ? Colors.white
                                    : AuthTheme.brown,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              );
            },
          ),
        ),
        ),
      ),
      const SizedBox(height: 8),
      const Text(
        'Tap or drag the numbers in order',
        textAlign: TextAlign.center,
        style: TextStyle(color: AuthTheme.mutedBrown),
      ),
    ];
  }

  double _connectDotRadius(double canvasSize, int count) {
    if (count <= 0) return 12;
    final byCount = canvasSize / (count * 1.05 + 8);
    return byCount.clamp(8.0, count > 12 ? 11.0 : 13.0);
  }

  Map? _hitConnectDot(
    Offset local,
    List dots,
    double w,
    double h,
    double pad,
    double hitRadius,
  ) {
    Map? best;
    var bestDist = hitRadius;
    for (final d in _visibleConnectDots(dots)) {
      final pos = _connectDotOffset(d, w, h, pad);
      final dist = (pos - local).distance;
      if (dist <= bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  /// Hide duplicate stacked dots (same x/y) so closing points don't cover each other.
  List<Map> _visibleConnectDots(List dots) {
    final seen = <String>{};
    final out = <Map>[];
    for (final raw in dots) {
      if (raw is! Map) continue;
      final x = (num.tryParse('${raw['x']}') ?? 0).round();
      final y = (num.tryParse('${raw['y']}') ?? 0).round();
      final key = '$x:$y';
      if (seen.contains(key)) continue;
      seen.add(key);
      out.add(raw);
    }
    return out;
  }

  Offset _connectDotOffset(Map d, double w, double h, double pad) {
    final x = (num.tryParse('${d['x']}') ?? 50) / 100;
    final y = (num.tryParse('${d['y']}') ?? 50) / 100;
    final usableW = (w - 2 * pad).clamp(1.0, w);
    final usableH = (h - 2 * pad).clamp(1.0, h);
    return Offset(pad + x * usableW, pad + y * usableH);
  }

  /// Sequence ids that actually exist on the board (ignores orphan config ids).
  List<String> _connectExpectedIds(Map<String, dynamic> cfg) {
    final dots = (cfg['dots'] is List) ? List.from(cfg['dots'] as List) : [];
    final existing = <String>{
      for (final raw in dots)
        if (raw is Map && '${raw['id'] ?? ''}'.isNotEmpty) '${raw['id']}',
    };
    var expected = (cfg['sequence'] is List)
        ? (cfg['sequence'] as List)
            .map((e) => '$e')
            .where((id) => existing.contains(id))
            .toList()
        : <String>[];
    if (expected.isEmpty) {
      expected = existing.toList()
        ..sort((a, b) {
          final an = int.tryParse(a);
          final bn = int.tryParse(b);
          if (an != null && bn != null) return an.compareTo(bn);
          return a.compareTo(b);
        });
    }
    return expected;
  }

  /// After the unique dots are connected, auto-finish stacked/closing ids
  /// that sit on the same coordinates (e.g. last point = first point).
  void _appendStackedConnectIds(List dots, List<String> expected) {
    var guard = 0;
    while (_connectSeq.length < expected.length && guard < expected.length + 2) {
      guard += 1;
      final next = expected[_connectSeq.length];
      if (_connectSeq.contains(next)) {
        // Same id repeated in sequence — treat as already satisfied.
        _connectSeq.add(next);
        continue;
      }
      final nextDot = _dotById(dots, next);
      if (nextDot == null) {
        _connectSeq.add(next);
        continue;
      }
      final covers = _connectSeq.any((id) {
        final d = _dotById(dots, id);
        return d != null && _sameConnectPos(d, nextDot);
      });
      if (!covers) break;
      _connectSeq.add(next);
    }
  }

  Map? _dotById(List dots, String id) {
    for (final raw in dots) {
      if (raw is Map && '${raw['id']}' == id) return raw;
    }
    return null;
  }

  bool _sameConnectPos(Map? a, Map? b) {
    if (a == null || b == null) return false;
    final ax = (num.tryParse('${a['x']}') ?? 0).round();
    final ay = (num.tryParse('${a['y']}') ?? 0).round();
    final bx = (num.tryParse('${b['x']}') ?? 0).round();
    final by = (num.tryParse('${b['y']}') ?? 0).round();
    return ax == bx && ay == by;
  }

  List<Widget> _paint(Map<String, dynamic> cfg) {
    final colours = (cfg['colours'] is List)
        ? (cfg['colours'] as List)
            .map((e) => _parseColor('$e'))
            .whereType<Color>()
            .toList()
        : <Color>[];
    return [
      SketchCanvas(
        key: _sketchKey,
        palette: colours,
        height: 360,
        onStrokeCountChanged: (n) => setState(() => _strokes = n),
      ),
    ];
  }

  List<Widget> _dragDrop(Map<String, dynamic> cfg) {
    final targets = (cfg['targets'] is List) ? cfg['targets'] as List : [];
    final items = (cfg['items'] is List) ? cfg['items'] as List : [];
    return [
      ...targets.map((t) {
        final tm = t is Map ? t : {};
        final tid = '${tm['id']}';
        final label = '${tm['label'] ?? tid}';
        final assigned = items.where((it) {
          final m = it is Map ? it : {};
          return _placements['${m['id']}'] == tid;
        }).toList();
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: DragTarget<String>(
            onAcceptWithDetails: (d) {
              setState(() => _placements[d.data] = tid);
            },
            builder: (context, candidate, rejected) {
              return Container(
                width: double.infinity,
                constraints: const BoxConstraints(minHeight: 88),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: candidate.isNotEmpty
                      ? AuthTheme.green.withValues(alpha: 0.12)
                      : Colors.white.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: AuthTheme.brown.withValues(alpha: 0.15),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: assigned.map((it) {
                        final m = it is Map ? it : {};
                        return Chip(
                          label: Text(
                            '${m['emoji'] ?? ''} ${m['label'] ?? m['id']}',
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      }),
      const Text('Drag items:', style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Wrap(
        spacing: 10,
        runSpacing: 10,
        children: items.map((it) {
          final m = it is Map ? it : {};
          final id = '${m['id']}';
          if (_placements.containsKey(id)) return const SizedBox.shrink();
          return Draggable<String>(
            data: id,
            feedback: Material(
              elevation: 4,
              borderRadius: BorderRadius.circular(12),
              child: _itemChip(m),
            ),
            childWhenDragging: Opacity(opacity: 0.3, child: _itemChip(m)),
            child: _itemChip(m),
          );
        }).toList(),
      ),
    ];
  }

  Widget _itemChip(Map m) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.2)),
      ),
      child: Text(
        '${m['emoji'] ?? ''} ${m['label'] ?? m['id']}',
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    );
  }

  List<Widget> _matching(Map<String, dynamic> cfg) {
    final pairs = (cfg['pairs'] is List) ? cfg['pairs'] as List : [];
    final rights = pairs.map((p) {
      final m = p is Map ? p : {};
      return '${m['right']}';
    }).toList()
      ..shuffle();
    return [
      ...pairs.asMap().entries.map((e) {
        final m = e.value is Map ? e.value as Map : {};
        final key = '${m['id'] ?? e.key}';
        final left = '${m['left']}';
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Expanded(
                child: Text(left,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              Expanded(
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _matches[key],
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: rights
                      .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _matches[key] = v);
                  },
                ),
              ),
            ],
          ),
        );
      }),
    ];
  }

  List<Widget> _sorting(Map<String, dynamic> cfg) {
    // reuse drag-drop UI with categories as targets
    return _dragDrop({
      'targets': cfg['categories'],
      'items': (cfg['items'] is List)
          ? (cfg['items'] as List).map((it) {
              final m = Map<String, dynamic>.from(it is Map ? it : {});
              m['target'] = m['categoryId'];
              return m;
            }).toList()
          : [],
    });
  }

  List<Widget> _arrange(Map<String, dynamic> cfg) {
    final items = (cfg['items'] is List) ? cfg['items'] as List : [];
    String labelFor(String id) {
      for (final it in items) {
        final m = it is Map ? it : {};
        if ('${m['id']}' == id) return '${m['label'] ?? id}';
      }
      return id;
    }

    return [
      ReorderableListView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: _order.length,
        onReorder: (oldIndex, newIndex) {
          setState(() {
            if (newIndex > oldIndex) newIndex -= 1;
            final item = _order.removeAt(oldIndex);
            _order.insert(newIndex, item);
          });
        },
        itemBuilder: (context, index) {
          final id = _order[index];
          return ListTile(
            key: ValueKey(id),
            tileColor: Colors.white.withValues(alpha: 0.92),
            title: Text(labelFor(id),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            trailing: const Icon(Icons.drag_handle),
          );
        },
      ),
    ];
  }

  List<Widget> _tapCorrect(Map<String, dynamic> cfg) {
    final options = (cfg['options'] is List) ? cfg['options'] as List : [];
    return [
      if (cfg['prompt'] != null)
        Text('${cfg['prompt']}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 12),
      Wrap(
        spacing: 10,
        runSpacing: 10,
        children: options.asMap().entries.map((e) {
          final m = e.value is Map ? e.value as Map : {'label': e.value};
          final id = '${m['id'] ?? e.key}';
          final selected = _selectedId == id || _selectedIndex == e.key;
          return InkWell(
            onTap: () => setState(() {
              _selectedId = id;
              _selectedIndex = e.key;
            }),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 110,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: selected ? AuthTheme.green : Colors.black12,
                  width: selected ? 2.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  Text('${m['emoji'] ?? '🔹'}',
                      style: const TextStyle(fontSize: 28)),
                  const SizedBox(height: 6),
                  Text(
                    '${m['label'] ?? id}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    ];
  }

  List<Widget> _financial(Map<String, dynamic> cfg) {
    final choices = (cfg['choices'] is List) ? cfg['choices'] as List : [];
    final currency = '${cfg['currency'] ?? '₹'}';
    return [
      Text(
        '${cfg['scenario'] ?? ''}',
        style: const TextStyle(fontSize: 16, height: 1.4, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 8),
      Text(
        'Your wallet: $_walletBalance pts',
        style: const TextStyle(
          color: AuthTheme.green,
          fontWeight: FontWeight.w800,
        ),
      ),
      if (cfg['budget'] != null) ...[
        const SizedBox(height: 4),
        Text(
          'Scenario budget: $currency${cfg['budget']}',
          style: const TextStyle(
            color: AuthTheme.mutedBrown,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
      const SizedBox(height: 12),
      ...choices.asMap().entries.map((e) {
        final m = e.value is Map ? e.value as Map : {};
        final id = '${m['id'] ?? e.key}';
        final spend = int.tryParse('${m['walletSpend'] ?? 0}') ?? 0;
        final selected = _selectedId == id || _selectedIndex == e.key;
        final canAfford = spend <= 0 || spend <= _walletBalance;
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: !canAfford
                ? Colors.black12
                : selected
                    ? AuthTheme.green.withValues(alpha: 0.15)
                    : Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: !canAfford
                  ? null
                  : () => setState(() {
                        _selectedId = id;
                        _selectedIndex = e.key;
                      }),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${m['label'] ?? id}',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        height: 1.35,
                        color: canAfford ? AuthTheme.brown : AuthTheme.mutedBrown,
                      ),
                    ),
                    if (spend > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          canAfford
                              ? 'Uses $spend wallet pts'
                              : 'Need $spend pts (not enough)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: canAfford
                                ? AuthTheme.green
                                : Colors.red.shade700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      }),
    ];
  }

  List<Widget> _quiz(Map<String, dynamic> cfg) {
    final questions = (cfg['questions'] is List) ? cfg['questions'] as List : [];
    final q = questions.isNotEmpty
        ? (questions.first is Map ? questions.first as Map : {})
        : cfg;
    final prompt = '${q['prompt'] ?? cfg['prompt'] ?? 'Choose the best answer'}';
    final options = (q['options'] is List)
        ? q['options'] as List
        : (cfg['options'] is List ? cfg['options'] as List : []);
    return [
      Text(prompt,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 12),
      ...options.asMap().entries.map((e) {
        final label = e.value is Map
            ? '${(e.value as Map)['label'] ?? e.value}'
            : '${e.value}';
        final selected = _selectedIndex == e.key;
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: selected
                ? AuthTheme.green.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: () => setState(() {
                _selectedIndex = e.key;
                _selectedId = e.value is Map
                    ? '${(e.value as Map)['id'] ?? e.key}'
                    : '${e.key}';
              }),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Text(String.fromCharCode(65 + e.key),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(label)),
                  ],
                ),
              ),
            ),
          ),
        );
      }),
    ];
  }

  Color? _parseColor(String raw) {
    var h = raw.replaceAll('#', '').trim();
    if (h.length == 6) h = 'FF$h';
    final v = int.tryParse(h, radix: 16);
    return v == null ? null : Color(v);
  }
}

class _ConnectPainter extends CustomPainter {
  _ConnectPainter({
    required this.dots,
    required this.sequence,
    required this.width,
    required this.height,
    required this.pad,
    this.strokeWidth = 3,
    this.finger,
  });

  final List dots;
  final List<String> sequence;
  final double width;
  final double height;
  final double pad;
  final double strokeWidth;
  final Offset? finger;

  Offset? _pos(String id) {
    for (final raw in dots) {
      final d = raw is Map ? raw : {};
      if ('${d['id']}' == id) {
        final x = (num.tryParse('${d['x']}') ?? 50) / 100;
        final y = (num.tryParse('${d['y']}') ?? 50) / 100;
        final usableW = (width - 2 * pad).clamp(1.0, width);
        final usableH = (height - 2 * pad).clamp(1.0, height);
        return Offset(pad + x * usableW, pad + y * usableH);
      }
    }
    return null;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AuthTheme.green
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    if (sequence.length >= 2) {
      for (var i = 0; i < sequence.length - 1; i++) {
        final a = _pos(sequence[i]);
        final b = _pos(sequence[i + 1]);
        if (a != null && b != null) canvas.drawLine(a, b, paint);
      }
    }

    if (finger != null && sequence.isNotEmpty) {
      final from = _pos(sequence.last);
      if (from != null) {
        final preview = Paint()
          ..color = AuthTheme.green.withValues(alpha: 0.45)
          ..strokeWidth = strokeWidth
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(from, finger!, preview);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ConnectPainter oldDelegate) => true;
}
