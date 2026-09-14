import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'auth_widgets.dart';
import 'course_network_image.dart';

enum CourseHtmlKind { h1, h2, h3, p, li, callout, explain, flashcard, quickCheck, image, split, toc, formula, table }

bool _isNightInk(Color? ink) => ink != null && ink.computeLuminance() > 0.45;

class CourseHtmlBlock {
  const CourseHtmlBlock(
    this.kind,
    this.text, {
    this.src,
    this.caption,
    this.imageRight = false,
    this.id,
    this.showHeader = true,
  });
  final CourseHtmlKind kind;
  final String text;
  final String? src;
  final String? caption;
  final bool imageRight;
  final String? id;
  final bool showHeader;

  CourseHtmlBlock withText(String text, {bool? showHeader}) => CourseHtmlBlock(
        kind,
        text,
        src: src,
        caption: caption,
        imageRight: imageRight,
        id: id,
        showHeader: showHeader ?? this.showHeader,
      );
}

TextStyle courseHtmlStyle(CourseHtmlKind kind, {Color? ink, Color? muted}) {
  final body = ink ?? AuthTheme.brown;
  final caption = muted ?? AuthTheme.mutedBrown;
  return switch (kind) {
    CourseHtmlKind.h1 => TextStyle(
        fontFamily: 'serif',
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: body,
        height: 1.25,
      ),
    CourseHtmlKind.h2 => TextStyle(
        fontFamily: 'serif',
        fontSize: 16.5,
        fontWeight: FontWeight.w700,
        color: body,
        height: 1.3,
      ),
    CourseHtmlKind.h3 => TextStyle(
        fontFamily: 'serif',
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: body,
        height: 1.35,
      ),
    CourseHtmlKind.callout => TextStyle(
        fontSize: 14.5,
        height: 1.45,
        color: body,
      ),
    CourseHtmlKind.explain => TextStyle(
        fontFamily: 'serif',
        fontSize: 14.5,
        height: 1.5,
        fontStyle: FontStyle.italic,
        color: body,
      ),
    CourseHtmlKind.flashcard => TextStyle(
        fontFamily: 'serif',
        fontSize: 16,
        height: 1.4,
        fontWeight: FontWeight.w700,
        color: body,
      ),
    CourseHtmlKind.quickCheck => TextStyle(
        fontFamily: 'serif',
        fontSize: 15,
        height: 1.4,
        color: body,
      ),
    CourseHtmlKind.li => TextStyle(
        fontFamily: 'serif',
        fontSize: 15.5,
        height: 1.5,
        color: body,
      ),
    CourseHtmlKind.image => TextStyle(
        fontSize: 12,
        fontStyle: FontStyle.italic,
        height: 1.35,
        color: caption,
      ),
    CourseHtmlKind.split => TextStyle(
        fontFamily: 'serif',
        fontSize: 14.5,
        height: 1.45,
        color: body,
      ),
    CourseHtmlKind.toc => TextStyle(
        fontFamily: 'serif',
        fontSize: 14.5,
        height: 1.45,
        color: body,
      ),
    CourseHtmlKind.formula => TextStyle(
        fontFamily: 'serif',
        fontSize: 15.5,
        height: 1.5,
        fontStyle: FontStyle.italic,
        color: body,
      ),
    CourseHtmlKind.table => TextStyle(
        fontFamily: 'serif',
        fontSize: 13.5,
        height: 1.35,
        color: body,
      ),
    CourseHtmlKind.p => TextStyle(
        fontFamily: 'serif',
        fontSize: 15.5,
        height: 1.62,
        color: body,
      ),
  };
}

EdgeInsets courseHtmlBlockInsets(CourseHtmlKind kind, {bool firstOnPage = false}) {
  final top = switch (kind) {
    CourseHtmlKind.h1 => firstOnPage ? 0.0 : 6.0,
    CourseHtmlKind.h2 => firstOnPage ? 2.0 : 14.0,
    CourseHtmlKind.h3 => firstOnPage ? 2.0 : 12.0,
    CourseHtmlKind.callout => 8.0,
    CourseHtmlKind.explain => 6.0,
    CourseHtmlKind.flashcard => 8.0,
    CourseHtmlKind.quickCheck => 8.0,
    CourseHtmlKind.li => 3.0,
    CourseHtmlKind.image => 8.0,
    CourseHtmlKind.split => 8.0,
    CourseHtmlKind.toc => 8.0,
    CourseHtmlKind.formula => firstOnPage ? 0.0 : 8.0,
    CourseHtmlKind.table => 8.0,
    CourseHtmlKind.p => firstOnPage ? 0.0 : 8.0,
  };
  final bottom = switch (kind) {
    CourseHtmlKind.h1 => 10.0,
    CourseHtmlKind.h2 => 8.0,
    CourseHtmlKind.h3 => 6.0,
    CourseHtmlKind.callout => 10.0,
    CourseHtmlKind.explain => 8.0,
    CourseHtmlKind.flashcard => 12.0,
    CourseHtmlKind.quickCheck => 12.0,
    CourseHtmlKind.li => 5.0,
    CourseHtmlKind.image => 10.0,
    CourseHtmlKind.split => 10.0,
    CourseHtmlKind.toc => 10.0,
    CourseHtmlKind.formula => 10.0,
    CourseHtmlKind.table => 10.0,
    CourseHtmlKind.p => 10.0,
  };
  return EdgeInsets.only(top: top, bottom: bottom);
}

double courseHtmlBlockSpacing(CourseHtmlKind kind) {
  final insets = courseHtmlBlockInsets(kind);
  return insets.top + insets.bottom;
}

/// Lightweight HTML renderer for course chapter content (no flutter_html).
class CourseHtmlView extends StatelessWidget {
  const CourseHtmlView({super.key, required this.html});

  final String html;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final block in parseCourseHtml(html)) CourseHtmlBlockView(block: block),
      ],
    );
  }
}

class CourseHtmlBlockView extends StatelessWidget {
  const CourseHtmlBlockView({
    super.key,
    required this.block,
    this.compact = false,
    this.firstOnPage = false,
    this.imageHeight = 180,
    this.highlights = const [],
    this.ink,
    this.muted,
    this.openExplains = const <String>{},
    this.onToggleExplain,
  });

  final CourseHtmlBlock block;
  final bool compact;
  final bool firstOnPage;
  final double imageHeight;
  final List<CourseHighlightMark> highlights;
  final Color? ink;
  final Color? muted;
  final Set<String> openExplains;
  final void Function(String id)? onToggleExplain;

  @override
  Widget build(BuildContext context) {
    if (block.kind == CourseHtmlKind.image || block.kind == CourseHtmlKind.split) {
      final caption = _displayCaption(block.caption ?? '');
      final hasSrc = (block.src ?? '').trim().isNotEmpty;
      final figure = Column(
        children: [
          if (hasSrc)
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: CourseNetworkImage(
                src: block.src!,
                height: block.kind == CourseHtmlKind.split
                    ? (imageHeight * 0.7).clamp(120, 180).toDouble()
                    : imageHeight,
                fallbackText: caption,
              ),
            )
          else if (caption.isNotEmpty)
            Text(caption, textAlign: TextAlign.center, style: courseHtmlStyle(CourseHtmlKind.image, ink: ink, muted: muted)),
          if (hasSrc && caption.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                caption,
                textAlign: TextAlign.center,
                style: courseHtmlStyle(CourseHtmlKind.image, ink: ink, muted: muted),
              ),
            ),
        ],
      );
      final insets = courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage);
      if (block.kind == CourseHtmlKind.split) {
        final textCol = Expanded(
          flex: 6,
          child: CourseStudyText(
            text: block.text,
            style: courseHtmlStyle(CourseHtmlKind.split, ink: ink, muted: muted),
            highlights: highlights,
          ),
        );
        final imageCol = Expanded(flex: 5, child: figure);
        return Padding(
          padding: insets,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: block.imageRight
                ? [textCol, const SizedBox(width: 12), imageCol]
                : [imageCol, const SizedBox(width: 12), textCol],
          ),
        );
      }
      return Padding(padding: insets, child: figure);
    }

    final style = courseHtmlStyle(block.kind, ink: ink, muted: muted);
    final text = CourseStudyText(
      text: block.text,
      style: style,
      highlights: highlights,
    );
    final child = Padding(
      padding: courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage),
      child: text,
    );

    if (block.kind == CourseHtmlKind.toc) {
      final items = block.text
          .split('\n')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();
      return Padding(
        padding: courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: AuthTheme.mutedBrown.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AuthTheme.mutedBrown.withValues(alpha: 0.25)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                ((block.caption ?? '').trim().isEmpty) ? 'Contents' : block.caption!.trim(),
                style: courseHtmlStyle(CourseHtmlKind.h3, ink: ink, muted: muted),
              ),
              const SizedBox(height: 6),
              for (var i = 0; i < items.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('${i + 1}. ${items[i]}', style: style),
                ),
            ],
          ),
        ),
      );
    }
    if (block.kind == CourseHtmlKind.callout) {
      final night = _isNightInk(ink);
      return Padding(
        padding: courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: night ? const Color(0xFF2C3A30) : AuthTheme.green.withValues(alpha: 0.07),
            borderRadius: BorderRadius.circular(4),
            border: const Border(
              left: BorderSide(color: AuthTheme.green, width: 3),
            ),
          ),
          child: text,
        ),
      );
    }
    if (block.kind == CourseHtmlKind.explain) {
      final id = block.id ?? block.text;
      return _ExplainFold(
        text: block.text,
        highlights: highlights,
        firstOnPage: firstOnPage,
        ink: ink,
        muted: muted,
        open: openExplains.contains(id),
        showHeader: block.showHeader,
        onToggle: () => onToggleExplain?.call(id),
      );
    }
    if (block.kind == CourseHtmlKind.flashcard) {
      return _InlineFlashcard(
        front: block.text,
        back: block.caption ?? '',
        firstOnPage: firstOnPage,
        ink: ink,
        muted: muted,
      );
    }
    if (block.kind == CourseHtmlKind.quickCheck) {
      return _InlineQuickCheck(block: block, firstOnPage: firstOnPage, ink: ink, muted: muted);
    }
    if (block.kind == CourseHtmlKind.formula) {
      final night = _isNightInk(ink);
      return Padding(
        padding: courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: night ? const Color(0xFF2A2620) : AuthTheme.brown.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(block.text, textAlign: TextAlign.center, style: style),
        ),
      );
    }
    if (block.kind == CourseHtmlKind.table) {
      return _CourseTableView(block: block, firstOnPage: firstOnPage, ink: ink, muted: muted);
    }
    if (block.kind == CourseHtmlKind.li) {
      return Padding(
        padding: courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 3, right: 8),
              child: Text('•', style: TextStyle(fontSize: 14, height: 1.5, color: ink ?? AuthTheme.brown)),
            ),
            Expanded(child: text),
          ],
        ),
      );
    }
    return child;
  }
}

class _CourseTableView extends StatelessWidget {
  const _CourseTableView({
    required this.block,
    required this.firstOnPage,
    this.ink,
    this.muted,
  });

  final CourseHtmlBlock block;
  final bool firstOnPage;
  final Color? ink;
  final Color? muted;

  @override
  Widget build(BuildContext context) {
    final rows = block.text
        .split('\n')
        .map((line) => line.split('|').map((cell) => cell.trim()).toList())
        .where((row) => row.any((cell) => cell.isNotEmpty))
        .toList();
    if (rows.isEmpty) return const SizedBox.shrink();
    final width = rows.fold<int>(0, (best, row) => math.max(best, row.length));
    final padded = rows
        .map((row) => [...row, ...List<String>.filled(math.max(0, width - row.length), '')])
        .toList();
    final caption = (block.caption ?? '').trim();
    final bodyStyle = courseHtmlStyle(CourseHtmlKind.table, ink: ink, muted: muted);
    final headStyle = bodyStyle.copyWith(fontWeight: FontWeight.w700, fontSize: 12.5);
    return Padding(
      padding: courseHtmlBlockInsets(CourseHtmlKind.table, firstOnPage: firstOnPage),
      child: Column(
        children: [
          Table(
            border: TableBorder.all(color: (muted ?? AuthTheme.mutedBrown).withValues(alpha: 0.35)),
            defaultVerticalAlignment: TableCellVerticalAlignment.middle,
            children: [
              for (var r = 0; r < padded.length; r++)
                TableRow(
                  decoration: r == 0
                      ? BoxDecoration(color: (muted ?? AuthTheme.mutedBrown).withValues(alpha: 0.12))
                      : null,
                  children: [
                    for (final cell in padded[r])
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                        child: Text(cell, style: r == 0 ? headStyle : bodyStyle),
                      ),
                  ],
                ),
            ],
          ),
          if (caption.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                caption,
                textAlign: TextAlign.center,
                style: courseHtmlStyle(CourseHtmlKind.image, ink: ink, muted: muted),
              ),
            ),
        ],
      ),
    );
  }
}

class _ExplainFold extends StatelessWidget {
  const _ExplainFold({
    required this.text,
    required this.highlights,
    required this.firstOnPage,
    required this.open,
    required this.onToggle,
    this.showHeader = true,
    this.ink,
    this.muted,
  });

  final String text;
  final List<CourseHighlightMark> highlights;
  final bool firstOnPage;
  final bool open;
  final VoidCallback onToggle;
  final bool showHeader;
  final Color? ink;
  final Color? muted;

  @override
  Widget build(BuildContext context) {
    final mutedColor = muted ?? AuthTheme.mutedBrown;
    return Padding(
      padding: courseHtmlBlockInsets(CourseHtmlKind.explain, firstOnPage: firstOnPage),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0x14C4A574),
          borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
          border: const Border(
            left: BorderSide(color: Color(0xFFC4A574), width: 3),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showHeader)
              InkWell(
                onTap: onToggle,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                  child: Row(
                    children: [
                      Icon(
                        open ? Icons.expand_less : Icons.expand_more,
                        size: 18,
                        color: mutedColor,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'In simple words',
                        style: TextStyle(
                          fontStyle: FontStyle.italic,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: mutedColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (open)
              Padding(
                padding: EdgeInsets.fromLTRB(10, showHeader ? 0 : 8, 10, 10),
                child: CourseStudyText(
                  text: text,
                  style: courseHtmlStyle(CourseHtmlKind.explain, ink: ink, muted: muted),
                  highlights: highlights,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _InlineFlashcard extends StatefulWidget {
  const _InlineFlashcard({
    required this.front,
    required this.back,
    required this.firstOnPage,
    this.ink,
    this.muted,
  });

  final String front;
  final String back;
  final bool firstOnPage;
  final Color? ink;
  final Color? muted;

  @override
  State<_InlineFlashcard> createState() => _InlineFlashcardState();
}

class _InlineFlashcardState extends State<_InlineFlashcard> {
  bool _flipped = false;

  @override
  Widget build(BuildContext context) {
    final muted = widget.muted ?? AuthTheme.mutedBrown;
    final ink = widget.ink ?? AuthTheme.brown;
    final night = _isNightInk(ink);
    return Padding(
      padding: courseHtmlBlockInsets(CourseHtmlKind.flashcard, firstOnPage: widget.firstOnPage),
      child: Material(
        color: night
            ? (_flipped ? const Color(0xFF3A3226) : const Color(0xFF2C261E))
            : (_flipped ? const Color(0xFFFFF6C8) : const Color(0xFFFFFDF6)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: night ? const Color(0xFF6A5A46) : const Color(0xFFD8C4A4)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => setState(() => _flipped = !_flipped),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _flipped ? 'FLASHCARD · ANSWER' : 'FLASHCARD · TAP TO FLIP',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: muted,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _flipped ? (widget.back.isEmpty ? widget.front : widget.back) : widget.front,
                  style: courseHtmlStyle(CourseHtmlKind.flashcard, ink: ink, muted: muted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InlineQuickCheck extends StatefulWidget {
  const _InlineQuickCheck({
    required this.block,
    required this.firstOnPage,
    this.ink,
    this.muted,
  });
  final CourseHtmlBlock block;
  final bool firstOnPage;
  final Color? ink;
  final Color? muted;

  @override
  State<_InlineQuickCheck> createState() => _InlineQuickCheckState();
}

class _InlineQuickCheckState extends State<_InlineQuickCheck> {
  int? _picked;

  @override
  Widget build(BuildContext context) {
    final ink = widget.ink ?? AuthTheme.brown;
    final muted = widget.muted ?? AuthTheme.mutedBrown;
    final night = _isNightInk(ink);
    final options = (widget.block.caption ?? '').split('\u001e').where((item) => item.isNotEmpty).toList();
    final bits = (widget.block.src ?? '0').split('|');
    final answer = int.tryParse(bits.first) ?? 0;
    final explain = bits.skip(1).join('|');
    final checked = _picked != null;
    return Padding(
      padding: courseHtmlBlockInsets(CourseHtmlKind.quickCheck, firstOnPage: widget.firstOnPage),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: night ? const Color(0xFF2C261E) : const Color(0xFFFFFDF6),
          borderRadius: BorderRadius.circular(12),
          border: Border.fromBorderSide(
            BorderSide(color: night ? const Color(0xFF6A5A46) : const Color(0xFFD8C4A4)),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'QUICK CHECK',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: muted,
                ),
              ),
              const SizedBox(height: 6),
              Text(widget.block.text, style: courseHtmlStyle(CourseHtmlKind.quickCheck, ink: ink, muted: muted)),
              const SizedBox(height: 8),
              for (var i = 0; i < options.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Material(
                    color: checked && i == answer
                        ? (night ? const Color(0xFF1E3A24) : const Color(0xFFE8F4EA))
                        : checked && i == _picked
                            ? (night ? const Color(0xFF3A1E1A) : const Color(0xFFF8E8E4))
                            : (night ? const Color(0xFF1B1814) : Colors.white),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(
                        color: checked && i == answer
                            ? const Color(0xFF5CBF70)
                            : checked && i == _picked
                                ? const Color(0xFFE07060)
                                : (night ? const Color(0xFF6A5A46) : const Color(0xFFD8C4A4)),
                      ),
                    ),
                    child: InkWell(
                      onTap: checked ? null : () => setState(() => _picked = i),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            options[i],
                            style: courseHtmlStyle(CourseHtmlKind.quickCheck, ink: ink, muted: muted),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              if (checked && explain.isNotEmpty)
                Text(explain, style: courseHtmlStyle(CourseHtmlKind.explain, ink: ink, muted: muted)),
            ],
          ),
        ),
      ),
    );
  }
}

const kHighlighterColors = <String>[
  '#FFE66D',
  '#A8E6A1',
  '#FFB7C5',
  '#A8D8FF',
  '#FFC48A',
];

class CourseHighlightMark {
  const CourseHighlightMark({
    required this.text,
    this.color = '#FFE66D',
    this.pageNumber,
    this.wholeWord = false,
  });
  final String text;
  final String color;
  final int? pageNumber;
  final bool wholeWord;
}

Color parseHighlightColor(String? hex) {
  var value = (hex ?? '').trim();
  if (value.startsWith('#')) value = value.substring(1);
  if (value.length == 8) value = value.substring(2);
  if (value.length != 6) return const Color(0xCCFFE66D);
  final rgb = int.tryParse(value, radix: 16);
  if (rgb == null) return const Color(0xCCFFE66D);
  return Color(0xCC000000 | rgb);
}

class CourseStudyText extends StatelessWidget {
  const CourseStudyText({
    super.key,
    required this.text,
    required this.style,
    this.highlights = const [],
  });

  final String text;
  final TextStyle style;
  final List<CourseHighlightMark> highlights;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(children: highlightSpans(text, style, highlights)),
    );
  }
}

String _foldChar(String ch) {
  return switch (ch) {
    '\u2018' || '\u2019' || '\u201A' => "'",
    '\u201C' || '\u201D' || '\u201E' => '"',
    _ => ch.toLowerCase(),
  };
}

String _foldPhrase(String raw) {
  final buf = StringBuffer();
  var pendingSpace = false;
  for (final rune in raw.trim().runes) {
    final ch = String.fromCharCode(rune);
    if (ch.trim().isEmpty) {
      pendingSpace = buf.isNotEmpty;
      continue;
    }
    if (pendingSpace) {
      buf.write(' ');
      pendingSpace = false;
    }
    buf.write(_foldChar(ch));
  }
  return buf.toString();
}

bool highlightSame(String a, String b) {
  final left = _foldPhrase(a);
  final right = _foldPhrase(b);
  return left.length >= 2 && left == right;
}

bool highlightOverlaps(String highlightText, String selection) {
  final a = _foldPhrase(highlightText);
  final b = _foldPhrase(selection);
  if (a.length < 2 || b.length < 2) return false;
  return a.contains(b) || b.contains(a);
}

List<({int start, int end, Color color})> findHighlightRanges(
  String text,
  List<CourseHighlightMark> marks,
) {
  if (text.isEmpty || marks.isEmpty) return const [];
  final folded = StringBuffer();
  final indexMap = <int>[];
  var pendingSpace = false;
  for (var i = 0; i < text.length; i++) {
    final ch = text[i];
    if (ch.trim().isEmpty) {
      pendingSpace = folded.isNotEmpty;
      continue;
    }
    if (pendingSpace) {
      folded.write(' ');
      indexMap.add(i);
      pendingSpace = false;
    }
    folded.write(_foldChar(ch));
    indexMap.add(i);
  }
  final hay = folded.toString();
  if (hay.isEmpty || indexMap.isEmpty) return const [];

  final raw = <({int start, int end, Color color, int z})>[];
  for (var z = 0; z < marks.length; z++) {
    final mark = marks[z];
    final needle = _foldPhrase(mark.text);
    if (needle.length < 2) continue;
    var from = 0;
    while (true) {
      final at = hay.indexOf(needle, from);
      if (at < 0) break;
      final last = at + needle.length - 1;
      if (last >= indexMap.length) break;
      if (mark.wholeWord) {
        final beforeOk = at == 0 || hay[at - 1] == ' ';
        final afterOk = last + 1 >= hay.length || hay[last + 1] == ' ';
        if (!beforeOk || !afterOk) {
          from = at + 1;
          continue;
        }
      }
      raw.add((
        start: indexMap[at],
        end: indexMap[last] + 1,
        color: parseHighlightColor(mark.color),
        z: z,
      ));
      from = at + needle.length;
    }
  }
  if (raw.isEmpty) return const [];

  final points = <int>{};
  for (final range in raw) {
    points.add(range.start);
    points.add(range.end);
  }
  final sorted = points.toList()..sort();
  final painted = <({int start, int end, Color color})>[];
  for (var i = 0; i < sorted.length - 1; i++) {
    final a = sorted[i];
    final b = sorted[i + 1];
    if (a >= b) continue;
    ({int z, Color color})? best;
    for (final range in raw) {
      if (range.start <= a && range.end >= b) {
        if (best == null || range.z < best.z) {
          best = (z: range.z, color: range.color);
        }
      }
    }
    if (best == null) continue;
    if (painted.isNotEmpty && painted.last.end == a && painted.last.color == best.color) {
      final last = painted.removeLast();
      painted.add((start: last.start, end: b, color: last.color));
    } else {
      painted.add((start: a, end: b, color: best.color));
    }
  }
  return painted;
}

List<InlineSpan> highlightSpans(String text, TextStyle style, List<CourseHighlightMark> marks) {
  final ranges = findHighlightRanges(text, marks);
  if (ranges.isEmpty) return [TextSpan(text: text, style: style)];
  final out = <InlineSpan>[];
  var start = 0;
  for (final range in ranges) {
    if (range.start > start) {
      out.add(TextSpan(text: text.substring(start, range.start), style: style));
    }
    out.add(
      TextSpan(
        text: text.substring(range.start, range.end),
        style: style.copyWith(backgroundColor: range.color),
      ),
    );
    start = range.end;
  }
  if (start < text.length) {
    out.add(TextSpan(text: text.substring(start), style: style));
  }
  return out;
}

String _displayCaption(String raw) {
  final caption = raw.trim();
  if (caption.isEmpty) return '';
  final lower = caption.toLowerCase();
  if (lower.contains('whatsapp image') ||
      lower.contains('chatgpt image') ||
      lower.contains('screenshot') ||
      lower.startsWith('img_') ||
      RegExp(r'\.(jpe?g|png|webp|gif|heic)$', caseSensitive: false).hasMatch(caption)) {
    return '';
  }
  return caption;
}

String? _attr(String html, String name) {
  final dq = RegExp('$name\\s*=\\s*"([^"]*)"', caseSensitive: false).firstMatch(html);
  if (dq != null) return unescapeHtmlSrc(dq.group(1) ?? '');
  final sq = RegExp("$name\\s*=\\s*'([^']*)'", caseSensitive: false).firstMatch(html);
  if (sq != null) return unescapeHtmlSrc(sq.group(1) ?? '');
  final curly = RegExp('$name\\s*=\\s*[\u201c\u201d]([^\u201c\u201d]*)[\u201c\u201d]', caseSensitive: false)
      .firstMatch(html);
  if (curly != null) return unescapeHtmlSrc(curly.group(1) ?? '');
  return null;
}

CourseHtmlBlock? _tableBlock(String raw) {
  final rows = <String>[];
  for (final tr in RegExp(r'<tr\b[^>]*>([\s\S]*?)</tr>', caseSensitive: false).allMatches(raw)) {
    final cells = RegExp(r'<(?:th|td)\b[^>]*>([\s\S]*?)</(?:th|td)>', caseSensitive: false)
        .allMatches(tr.group(1) ?? '')
        .map((m) => _stripTags(m.group(1) ?? ''))
        .toList();
    if (cells.any((cell) => cell.isNotEmpty)) rows.add(cells.join('|'));
  }
  if (rows.isEmpty) return null;
  final cap = RegExp(r'<figcaption[^>]*>([\s\S]*?)</figcaption>', caseSensitive: false).firstMatch(raw);
  final caption = cap != null ? _stripTags(cap.group(1) ?? '') : '';
  return CourseHtmlBlock(CourseHtmlKind.table, rows.join('\n'), caption: caption.isEmpty ? null : caption);
}

CourseHtmlBlock? _imageBlock(String tagOrFigure) {
  final img = RegExp(r'<img\b[^>]*>', caseSensitive: false).firstMatch(tagOrFigure);
  final src = _attr(img?.group(0) ?? tagOrFigure, 'src');
  if (src == null || src.isEmpty) return null;
  final alt = _attr(img?.group(0) ?? tagOrFigure, 'alt') ?? '';
  final capMatch = RegExp(
    r'<figcaption[^>]*>([\s\S]*?)</figcaption>',
    caseSensitive: false,
  ).firstMatch(tagOrFigure);
  final caption = capMatch != null ? _stripTags(capMatch.group(1) ?? '') : alt;
  return CourseHtmlBlock(CourseHtmlKind.image, caption, src: src, caption: caption);
}

List<CourseHtmlBlock> parseCourseHtml(String html) {
  final cleaned = html
      .replaceAll(RegExp(r'</?article[^>]*>', caseSensitive: false), '')
      .trim();
  // Avoid backreferences — Dart can skip <figure>/<img> when mixed with </\1>.
  final re = RegExp(
    r'<img\b[^>]*>|'
    r'<figure\b[^>]*>[\s\S]*?</figure>|'
    r'<details\b[^>]*>[\s\S]*?</details>|'
    r'<aside\b[^>]*>[\s\S]*?</aside>|'
    r'<nav\b[^>]*>[\s\S]*?</nav>|'
    r'<table\b[^>]*>[\s\S]*?</table>|'
    r'<(h1)[^>]*>[\s\S]*?</h1>|'
    r'<(h2)[^>]*>[\s\S]*?</h2>|'
    r'<(h3)[^>]*>[\s\S]*?</h3>|'
    r'<(p)[^>]*>[\s\S]*?</p>|'
    r'<(li)[^>]*>[\s\S]*?</li>|'
    r'<(div)[^>]*>[\s\S]*?</div>',
    caseSensitive: false,
  );
  final out = <CourseHtmlBlock>[];
  for (final m in re.allMatches(cleaned)) {
    final raw = m.group(0) ?? '';
    final lower = raw.toLowerCase();
    if (lower.contains('<table')) {
      final table = _tableBlock(raw);
      if (table != null) out.add(table);
      continue;
    }
    if (lower.startsWith('<img') || lower.startsWith('<figure')) {
      final img = _imageBlock(raw);
      if (img != null) out.add(img);
      continue;
    }
    final open = RegExp(r'^<([a-z0-9]+)\b([^>]*)>', caseSensitive: false).firstMatch(raw);
    final tagName = (open?.group(1) ?? '').toLowerCase();
    final attrs = open?.group(2) ?? '';
    final inner = raw
        .replaceFirst(RegExp(r'^<[^>]+>'), '')
        .replaceFirst(RegExp(r'</[a-z0-9]+>\s*$', caseSensitive: false), '');
    final isExplain = tagName == 'details' ||
        ((tagName == 'aside' || tagName == 'div' || tagName == 'p') && attrs.contains('course-explain'));
    if (isExplain) {
      final body = inner
          .replaceFirst(RegExp(r'<summary\b[^>]*>[\s\S]*?</summary>', caseSensitive: false), ' ')
          .trim();
      final text = _stripTags(body);
      if (text.isNotEmpty) {
        out.add(CourseHtmlBlock(CourseHtmlKind.explain, text, id: 'explain-${out.length}'));
      }
      continue;
    }
    if (attrs.contains('course-flash')) {
      final strong = RegExp(r'<(strong|b)[^>]*>([\s\S]*?)</\1>', caseSensitive: false).firstMatch(inner);
      final front = _stripTags(strong?.group(2) ?? '');
      final back = _stripTags(strong != null ? inner.replaceFirst(strong.group(0)!, ' ') : inner);
      if (front.isNotEmpty) {
        out.add(CourseHtmlBlock(CourseHtmlKind.flashcard, front, caption: back, id: 'flash-${out.length}'));
      }
      continue;
    }
    if (attrs.contains('course-quick-block')) {
      final question = _stripTags(
        RegExp(r'course-quick-prompt[^>]*>([\s\S]*?)</', caseSensitive: false).firstMatch(inner)?.group(1) ?? inner,
      );
      final options = RegExp(r'data-opt=["\x27](\d+)["\x27][^>]*>([\s\S]*?)</', caseSensitive: false)
          .allMatches(inner)
          .map((m) => _stripTags(m.group(2) ?? ''))
          .where((item) => item.isNotEmpty)
          .toList();
      final answer = RegExp(r'data-answer=["\x27](\d+)["\x27]', caseSensitive: false).firstMatch(raw)?.group(1) ?? '0';
      final explain = _stripTags(
        RegExp(r'course-quick-explain[^>]*>([\s\S]*?)</', caseSensitive: false).firstMatch(inner)?.group(1) ?? '',
      );
      if (question.isNotEmpty && options.length >= 2) {
        out.add(
          CourseHtmlBlock(
            CourseHtmlKind.quickCheck,
            question,
            caption: options.join('\u001e'),
            src: '$answer|$explain',
            id: 'quick-${out.length}',
          ),
        );
      }
      continue;
    }
    if (tagName == 'nav' || attrs.contains('course-chapter-toc')) {
      final title = _stripTags(
        RegExp(r'course-kicker[^>]*>([\s\S]*?)</', caseSensitive: false).firstMatch(inner)?.group(1) ?? '',
      );
      final items = RegExp(r'<li\b[^>]*>([\s\S]*?)</li>', caseSensitive: false)
          .allMatches(inner)
          .map((m) => _stripTags(m.group(1) ?? ''))
          .where((item) => item.isNotEmpty)
          .toList();
      if (items.isNotEmpty) {
        out.add(CourseHtmlBlock(CourseHtmlKind.toc, items.join('\n'), caption: title.isEmpty ? 'Contents' : title));
      }
      continue;
    }
    if (attrs.contains('course-formula')) {
      final text = _stripTags(inner);
      if (text.isNotEmpty) out.add(CourseHtmlBlock(CourseHtmlKind.formula, text));
      continue;
    }
    if (tagName == 'div') {
      if (attrs.contains('course-split')) {
        final img = _imageBlock(inner);
        final withoutFigure = inner.replaceAll(
          RegExp(r'<figure\b[^>]*>[\s\S]*?</figure>|<img\b[^>]*>', caseSensitive: false),
          ' ',
        );
        out.add(CourseHtmlBlock(
          CourseHtmlKind.split,
          _stripTags(withoutFigure),
          src: img?.src,
          caption: img?.caption,
          imageRight: attrs.contains('course-split-rtl') || attrs.contains('image-right'),
        ));
        continue;
      }
      if (attrs.contains('course-callout')) {
        out.add(CourseHtmlBlock(CourseHtmlKind.callout, _stripTags(inner)));
      }
      final nested = _imageBlock(inner);
      if (nested != null) out.add(nested);
      continue;
    }
    final nestedImg = _imageBlock(inner);
    if (nestedImg != null) out.add(nestedImg);
    final kind = switch (tagName) {
      'h1' => CourseHtmlKind.h1,
      'h2' => CourseHtmlKind.h2,
      'h3' => CourseHtmlKind.h3,
      'li' => CourseHtmlKind.li,
      _ => attrs.contains('course-kicker')
          ? CourseHtmlKind.h3
          : attrs.contains('course-formula')
              ? CourseHtmlKind.formula
              : CourseHtmlKind.p,
    };
    final text = _stripTags(inner);
    if (text.isNotEmpty) out.add(CourseHtmlBlock(kind, text));
  }
  if (out.isEmpty) {
    final plain = _stripTags(cleaned);
    if (plain.isNotEmpty) out.add(CourseHtmlBlock(CourseHtmlKind.p, plain));
  }
  return out;
}

String _stripTags(String html) {
  return html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&times;', '×')
      .trim();
}
