import 'package:flutter/material.dart';

import 'auth_widgets.dart';

class SketchStroke {
  SketchStroke({
    required this.points,
    required this.color,
    required this.width,
  });

  final List<Offset> points;
  final Color color;
  final double width;
}

/// Finger-paint / sketch pad for Learn activities.
class SketchCanvas extends StatefulWidget {
  const SketchCanvas({
    super.key,
    this.palette = const [],
    this.height = 320,
    this.onStrokeCountChanged,
  });

  /// Optional activity colours (hex or Flutter colors via caller).
  final List<Color> palette;
  final double height;
  final ValueChanged<int>? onStrokeCountChanged;

  @override
  State<SketchCanvas> createState() => SketchCanvasState();
}

class SketchCanvasState extends State<SketchCanvas> {
  static const _defaults = [
    Color(0xFF1A1A1A),
    Color(0xFFE53935),
    Color(0xFF1E88E5),
    Color(0xFF43A047),
    Color(0xFFFDD835),
    Color(0xFF8E24AA),
    Color(0xFF6D4C41),
    Color(0xFFFFFFFF),
  ];

  final List<SketchStroke> _strokes = [];
  SketchStroke? _current;
  late Color _color;
  double _width = 5;
  bool _eraser = false;
  int _strokeCount = 0;

  int get strokeCount => _strokeCount;
  bool get hasDrawing => _strokeCount > 0;

  @override
  void initState() {
    super.initState();
    _color = widget.palette.isNotEmpty ? widget.palette.first : _defaults.first;
  }

  List<Color> get _colours {
    if (widget.palette.isEmpty) return _defaults;
    // Keep black + white for outline / highlights
    return [
      ...widget.palette,
      const Color(0xFF1A1A1A),
      const Color(0xFFFFFFFF),
    ];
  }

  void _notify() {
    widget.onStrokeCountChanged?.call(_strokeCount);
  }

  void undo() {
    if (_strokes.isEmpty) return;
    setState(() {
      _strokes.removeLast();
      _strokeCount = _strokes.length;
    });
    _notify();
  }

  void clear() {
    setState(() {
      _strokes.clear();
      _current = null;
      _strokeCount = 0;
    });
    _notify();
  }

  void _start(Offset p) {
    final c = _eraser ? const Color(0xFFF7F1E8) : _color;
    final w = _eraser ? _width * 3 : _width;
    setState(() {
      _current = SketchStroke(points: [p], color: c, width: w);
    });
  }

  void _move(Offset p) {
    if (_current == null) return;
    setState(() => _current!.points.add(p));
  }

  void _end() {
    if (_current == null) return;
    setState(() {
      if (_current!.points.length > 1) {
        _strokes.add(_current!);
        _strokeCount = _strokes.length;
      }
      _current = null;
    });
    _notify();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Text(
              'Sketch here',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: AuthTheme.brown,
              ),
            ),
            const Spacer(),
            IconButton(
              tooltip: 'Undo',
              onPressed: _strokes.isEmpty ? null : undo,
              icon: const Icon(Icons.undo, color: AuthTheme.brown),
            ),
            IconButton(
              tooltip: 'Clear',
              onPressed: _strokes.isEmpty ? null : clear,
              icon: const Icon(Icons.delete_outline, color: AuthTheme.logout),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: const Color(0xFFF7F1E8),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.18)),
            boxShadow: [
              BoxShadow(
                color: AuthTheme.brown.withValues(alpha: 0.08),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Listener(
              behavior: HitTestBehavior.opaque,
              onPointerDown: (e) => _start(e.localPosition),
              onPointerMove: (e) {
                // Keep drawing even if the parent ListView wants to scroll.
                _move(e.localPosition);
              },
              onPointerUp: (_) => _end(),
              onPointerCancel: (_) => _end(),
              child: CustomPaint(
                painter: _SketchPainter(
                  strokes: [
                    ..._strokes,
                    if (_current != null) _current!,
                  ],
                ),
                child: const SizedBox.expand(),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final c in _colours)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _eraser = false;
                      _color = c;
                    }),
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: c,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: !_eraser && _color == c
                              ? AuthTheme.green
                              : Colors.black26,
                          width: !_eraser && _color == c ? 3 : 1,
                        ),
                      ),
                    ),
                  ),
                ),
              GestureDetector(
                onTap: () => setState(() => _eraser = true),
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _eraser ? AuthTheme.green : Colors.black26,
                      width: _eraser ? 3 : 1,
                    ),
                  ),
                  child: const Icon(Icons.auto_fix_high, size: 18),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            const Text('Brush', style: TextStyle(color: AuthTheme.mutedBrown)),
            Expanded(
              child: Slider(
                value: _width,
                min: 2,
                max: 18,
                activeColor: AuthTheme.green,
                onChanged: (v) => setState(() => _width = v),
              ),
            ),
            Text(
              _width.round().toString(),
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AuthTheme.brown,
              ),
            ),
          ],
        ),
        if (!hasDrawing)
          const Text(
            'Draw with your finger — learning sticks better when you create.',
            style: TextStyle(
              color: AuthTheme.mutedBrown,
              fontSize: 12.5,
              height: 1.35,
            ),
          ),
      ],
    );
  }
}

class _SketchPainter extends CustomPainter {
  _SketchPainter({required this.strokes});

  final List<SketchStroke> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in strokes) {
      if (stroke.points.isEmpty) continue;
      final paint = Paint()
        ..color = stroke.color
        ..strokeWidth = stroke.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      if (stroke.points.length == 1) {
        canvas.drawCircle(stroke.points.first, stroke.width / 2, paint);
        continue;
      }
      final path = Path()..moveTo(stroke.points.first.dx, stroke.points.first.dy);
      for (var i = 1; i < stroke.points.length; i++) {
        path.lineTo(stroke.points[i].dx, stroke.points[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SketchPainter oldDelegate) => true;
}
