import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/pdf_page_rasterizer.dart';
import 'auth_widgets.dart';

/// Book-style page curl: swipe or tap the left/right edge.
class MagazinePageFlip extends StatefulWidget {
  const MagazinePageFlip({
    super.key,
    required this.rasterizer,
    required this.initialPage,
    this.onPageChanged,
  });

  final PdfPageRasterizer rasterizer;
  final int initialPage;
  final ValueChanged<int>? onPageChanged;

  @override
  State<MagazinePageFlip> createState() => MagazinePageFlipState();
}

class MagazinePageFlipState extends State<MagazinePageFlip>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  late int _page;
  bool _forward = true;
  bool _busy = false;

  int get currentPage => _page;
  int get pageCount => widget.rasterizer.pageCount;

  @override
  void initState() {
    super.initState();
    _page = widget.initialPage.clamp(1, math.max(1, pageCount)).toInt();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 640),
    );
    widget.rasterizer.preloadNearby(_page);
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  Future<void> flipNext() => _flip(forward: true);
  Future<void> flipPrevious() => _flip(forward: false);

  void goToPage(int page) {
    final target = page.clamp(1, math.max(1, pageCount)).toInt();
    if (target == _page && _anim.value == 0) return;
    _anim.stop();
    _busy = false;
    setState(() {
      _page = target;
      _anim.value = 0;
    });
    widget.rasterizer.preloadNearby(_page);
    widget.onPageChanged?.call(_page);
  }

  Future<void> _flip({required bool forward}) async {
    if (_busy) return;
    if (forward && _page >= pageCount) return;
    if (!forward && _page <= 1) return;
    _forward = forward;
    widget.rasterizer.preloadNearby(forward ? _page + 1 : _page - 1);
    await _animateTo(1, complete: true);
  }

  Future<void> _animateTo(double target, {required bool complete}) async {
    _busy = true;
    try {
      final dist = (target - _anim.value).abs();
      await _anim.animateTo(
        target,
        duration: Duration(milliseconds: (620 * dist).round().clamp(180, 640)),
        curve: complete ? Curves.easeInOutCubic : Curves.easeOutCubic,
      );
      if (!complete || !mounted) {
        if (target == 0) _anim.value = 0;
        return;
      }
      setState(() {
        _page = _forward ? _page + 1 : _page - 1;
        _anim.value = 0;
      });
      widget.rasterizer.preloadNearby(_page);
      widget.onPageChanged?.call(_page);
      HapticFeedback.mediumImpact();
    } finally {
      _busy = false;
    }
  }

  void _onDragUpdate(DragUpdateDetails details, double width) {
    if (_busy || width <= 0) return;
    if (_anim.value == 0) {
      final dx = details.delta.dx;
      if (dx.abs() < 0.6) return;
      final forward = dx < 0;
      if (forward && _page >= pageCount) return;
      if (!forward && _page <= 1) return;
      _forward = forward;
    }
    final delta = _forward ? -details.delta.dx : details.delta.dx;
    _anim.value = (_anim.value + delta / (width * 0.92)).clamp(0.0, 1.0);
  }

  Future<void> _onDragEnd(DragEndDetails details) async {
    if (_busy) return;
    if (_anim.value == 0) return;
    final v = details.primaryVelocity ?? 0;
    final fling = _forward ? v < -450 : v > 450;
    if (_anim.value > 0.18 || fling) {
      await _animateTo(1, complete: true);
    } else {
      await _animateTo(0, complete: false);
    }
  }

  Future<void> _onTapUp(TapUpDetails details, double width) async {
    if (_busy || _anim.value > 0) return;
    final x = details.localPosition.dx;
    if (x > width * 0.62) {
      await _flip(forward: true);
    } else if (x < width * 0.38) {
      await _flip(forward: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        final under = _forward ? _page + 1 : _page - 1;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onHorizontalDragUpdate: (d) => _onDragUpdate(d, w),
          onHorizontalDragEnd: _onDragEnd,
          onTapUp: (d) => _onTapUp(d, w),
          child: AnimatedBuilder(
            animation: _anim,
            builder: (context, _) {
              final t = _anim.value;
              return Stack(
                fit: StackFit.expand,
                children: [
                  if (t > 0 && under >= 1 && under <= pageCount)
                    _PdfRasterPage(
                      key: ValueKey('under-$under'),
                      rasterizer: widget.rasterizer,
                      pageNumber: under,
                    )
                  else
                    _PdfRasterPage(
                      key: ValueKey('page-$_page'),
                      rasterizer: widget.rasterizer,
                      pageNumber: _page,
                    ),
                  if (t > 0)
                    ClipPath(
                      clipper: _PageFoldClipper(progress: t, forward: _forward),
                      child: _PdfRasterPage(
                        key: ValueKey('flat-$_page'),
                        rasterizer: widget.rasterizer,
                        pageNumber: _page,
                      ),
                    ),
                  if (t > 0.01 && t < 0.97)
                    _TurningLeaf(
                      progress: t,
                      forward: _forward,
                      width: w,
                      height: h,
                      child: _PdfRasterPage(
                        key: ValueKey('leaf-$_page'),
                        rasterizer: widget.rasterizer,
                        pageNumber: _page,
                      ),
                    ),
                  if (t > 0)
                    IgnorePointer(
                      child: CustomPaint(
                        painter: _FoldShadowPainter(
                          progress: t,
                          forward: _forward,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _PageFoldClipper extends CustomClipper<Path> {
  _PageFoldClipper({required this.progress, required this.forward});

  final double progress;
  final bool forward;

  @override
  Path getClip(Size size) {
    final w = size.width;
    final h = size.height;
    final t = progress.clamp(0.0, 1.0);
    final path = Path();
    if (forward) {
      final fold = w * (1.0 - t);
      final curl = w * 0.16 * math.sin(t * math.pi);
      path.moveTo(0, 0);
      path.lineTo(fold, 0);
      path.cubicTo(fold + curl, h * 0.22, fold + curl * 0.35, h * 0.78, fold, h);
      path.lineTo(0, h);
      path.close();
    } else {
      final fold = w * t;
      final curl = w * 0.16 * math.sin(t * math.pi);
      path.moveTo(w, 0);
      path.lineTo(fold, 0);
      path.cubicTo(fold - curl, h * 0.22, fold - curl * 0.35, h * 0.78, fold, h);
      path.lineTo(w, h);
      path.close();
    }
    return path;
  }

  @override
  bool shouldReclip(covariant _PageFoldClipper oldClipper) =>
      oldClipper.progress != progress || oldClipper.forward != forward;
}

class _TurningLeaf extends StatelessWidget {
  const _TurningLeaf({
    required this.progress,
    required this.forward,
    required this.width,
    required this.height,
    required this.child,
  });

  final double progress;
  final bool forward;
  final double width;
  final double height;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = progress.clamp(0.01, 0.97);
    final flapW = math.max(8.0, width * t);
    final angle = t * math.pi;
    if (forward) {
      return Positioned(
        left: width - flapW,
        top: 0,
        width: flapW,
        height: height,
        child: Transform(
          alignment: Alignment.centerLeft,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.00135)
            ..rotateY(-angle),
          child: _leafBody(
            alignment: Alignment.centerRight,
            showBack: t > 0.5,
          ),
        ),
      );
    }
    return Positioned(
      left: 0,
      top: 0,
      width: flapW,
      height: height,
      child: Transform(
        alignment: Alignment.centerRight,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.00135)
          ..rotateY(angle),
        child: _leafBody(
          alignment: Alignment.centerLeft,
          showBack: t > 0.5,
        ),
      ),
    );
  }

  Widget _leafBody({required Alignment alignment, required bool showBack}) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRect(
          child: Align(
            alignment: alignment,
            widthFactor: 1,
            child: OverflowBox(
              maxWidth: width,
              alignment: alignment,
              child: SizedBox(width: width, height: height, child: child),
            ),
          ),
        ),
        if (showBack)
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  Color(0xFFCDBBA3),
                  Color(0xFFF6EBDA),
                  Color(0xFFE6D5BE),
                ],
              ),
            ),
          ),
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: forward ? Alignment.centerLeft : Alignment.centerRight,
                end: forward ? Alignment.centerRight : Alignment.centerLeft,
                colors: [
                  Colors.black.withValues(alpha: 0.18 * progress),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _FoldShadowPainter extends CustomPainter {
  _FoldShadowPainter({required this.progress, required this.forward});

  final double progress;
  final bool forward;

  @override
  void paint(Canvas canvas, Size size) {
    final t = progress.clamp(0.0, 1.0);
    if (t <= 0) return;
    final fold = forward ? size.width * (1.0 - t) : size.width * t;
    final paint = Paint()
      ..shader = ui.Gradient.linear(
        Offset(fold, 0),
        Offset(fold + (forward ? 28 : -28), 0),
        [
          Colors.black.withValues(alpha: 0.38 * math.sin(t * math.pi)),
          Colors.transparent,
        ],
      );
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint);
  }

  @override
  bool shouldRepaint(covariant _FoldShadowPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.forward != forward;
}

class _PdfRasterPage extends StatefulWidget {
  const _PdfRasterPage({
    super.key,
    required this.rasterizer,
    required this.pageNumber,
  });

  final PdfPageRasterizer rasterizer;
  final int pageNumber;

  @override
  State<_PdfRasterPage> createState() => _PdfRasterPageState();
}

class _PdfRasterPageState extends State<_PdfRasterPage> {
  Uint8List? _bytes;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _PdfRasterPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pageNumber != widget.pageNumber ||
        oldWidget.rasterizer != widget.rasterizer) {
      _bytes = null;
      _error = null;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final bytes = await widget.rasterizer.pageBytes(widget.pageNumber);
      if (!mounted) return;
      setState(() => _bytes = bytes);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white,
      child: _error != null
          ? Center(
              child: Text(
                'Could not render page ${widget.pageNumber}',
                style: const TextStyle(color: AuthTheme.mutedBrown),
              ),
            )
          : _bytes == null
              ? const Center(child: CircularProgressIndicator())
              : Image.memory(
                  _bytes!,
                  fit: BoxFit.contain,
                  gaplessPlayback: true,
                  filterQuality: FilterQuality.medium,
                ),
    );
  }
}
