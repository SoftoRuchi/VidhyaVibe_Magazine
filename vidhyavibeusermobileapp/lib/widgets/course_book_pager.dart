import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/course_study.dart';
import 'auth_widgets.dart';
import 'course_html_view.dart';
import 'course_network_image.dart';
import 'course_quick_check.dart';
import 'course_flashcards.dart';

const _paper = Color(0xFFF7F0E1);
const _rule = Color(0xFFD3BFA0);
const _spine = Color(0x14000000);
const _paperPad = EdgeInsets.fromLTRB(26, 16, 22, 10);
const _headerChrome = 54.0;
const _folioChrome = 34.0;
const _openBookMinWidth = 900.0;
const _tabletShortest = 600.0;

bool courseOpenBookLayout(Size size) {
  return size.shortestSide >= _tabletShortest && size.width >= _openBookMinWidth;
}

List<({int? left, int? right})> courseSpreads(int pageCount, int startPage) {
  final spreads = <({int? left, int? right})>[];
  if (pageCount <= 0) return [(left: 0, right: null)];
  spreads.add((left: 0, right: null));
  var i = 1;
  while (i < pageCount) {
    spreads.add((left: i, right: i + 1 < pageCount ? i + 1 : null));
    i += 2;
  }
  return spreads;
}

enum CoursePaperTheme { paper, sepia, night }

class CoursePaperPalette {
  const CoursePaperPalette({
    required this.paper,
    required this.rule,
    required this.text,
    required this.muted,
    required this.spine,
  });

  final Color paper;
  final Color rule;
  final Color text;
  final Color muted;
  final Color spine;

  static CoursePaperPalette of(CoursePaperTheme theme) {
    return switch (theme) {
      CoursePaperTheme.paper => const CoursePaperPalette(
          paper: _paper,
          rule: _rule,
          text: AuthTheme.brown,
          muted: AuthTheme.mutedBrown,
          spine: _spine,
        ),
      CoursePaperTheme.sepia => const CoursePaperPalette(
          paper: Color(0xFFF3E2B8),
          rule: Color(0xFFD2B48C),
          text: Color(0xFF4A2F12),
          muted: Color(0xFF7A5A32),
          spine: Color(0x22000000),
        ),
      CoursePaperTheme.night => const CoursePaperPalette(
          paper: Color(0xFF1B1814),
          rule: Color(0xFF3D3428),
          text: Color(0xFFE8DCC8),
          muted: Color(0xFFB7A48A),
          spine: Color(0x40FFFFFF),
        ),
    };
  }
}

class CourseBookPager extends StatefulWidget {
  const CourseBookPager({
    super.key,
    required this.html,
    required this.runningHeader,
    required this.chapterTitle,
    this.startPage = 1,
    this.footerActions,
    this.onPageChanged,
    this.highlights = const [],
    this.bookmarkTypes = const {},
    this.onHighlight,
    this.onRemoveHighlight,
    this.onNote,
    this.onSetBookmark,
    this.onRemoveBookmark,
    this.onOpenHighlights,
    this.onOpenNotes,
    this.onOpenPractice,
    this.onOpenChapters,
    this.onOpenQuickCheck,
    this.onAddFlashcard,
    this.onDeleteFlashcard,
    this.quickChecks = const [],
    this.flashcards = const [],
    this.frontCoverUrl,
    this.backCoverUrl,
  });

  final String html;
  final String runningHeader;
  final String chapterTitle;
  final int startPage;
  final Widget? footerActions;
  final void Function(int pageIndex, int pageCount, int printedPage)? onPageChanged;
  final List<CourseHighlightMark> highlights;
  final Map<int, String> bookmarkTypes;
  final void Function(String text, String color)? onHighlight;
  final void Function(String text)? onRemoveHighlight;
  final void Function(String text)? onNote;
  final void Function(int printedPage, String markType)? onSetBookmark;
  final void Function(int printedPage)? onRemoveBookmark;
  final VoidCallback? onOpenHighlights;
  final VoidCallback? onOpenNotes;
  final VoidCallback? onOpenPractice;
  final VoidCallback? onOpenChapters;
  final VoidCallback? onOpenQuickCheck;
  final void Function(String text)? onAddFlashcard;
  final Future<void> Function(CourseFlashcard card)? onDeleteFlashcard;
  final List<CourseQuickCheckItem> quickChecks;
  final List<CourseFlashcard> flashcards;
  final String? frontCoverUrl;
  final String? backCoverUrl;

  @override
  State<CourseBookPager> createState() => CourseBookPagerState();
}

class CourseBookPagerState extends State<CourseBookPager> {
  final PageController _controller = PageController();
  List<List<CourseHtmlBlock>> _pages = const [];
  Size? _pageSize;
  int _index = 0;
  int? _pendingIndex;
  String? _pendingAnchor;
  bool _holdPages = false;
  String _ink = kHighlighterColors.first;
  CoursePaperTheme _theme = CoursePaperTheme.paper;
  double _fontScale = 1;
  String _searchNeedle = '';
  String _quoteNeedle = '';
  bool _wantSpread = true;
  bool _lastSpread = false;
  Set<String> _openExplains = {};
  String? _pendingExplainId;

  @override
  void initState() {
    super.initState();
    _loadDisplay();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadDisplay() async {
    final prefs = await SharedPreferences.getInstance();
    final themeName = prefs.getString('vv_course_theme');
    final font = prefs.getDouble('vv_course_font');
    final spread = prefs.getBool('vv_course_spread');
    if (!mounted) return;
    final nextTheme = CoursePaperTheme.values.firstWhere(
      (item) => item.name == themeName,
      orElse: () => CoursePaperTheme.paper,
    );
    final nextFont = (font ?? 1).clamp(0.85, 1.35);
    final nextSpread = spread ?? true;
    if (nextTheme == _theme && nextFont == _fontScale && nextSpread == _wantSpread) return;
    final fontChanged = nextFont != _fontScale;
    setState(() {
      _theme = nextTheme;
      _fontScale = nextFont;
      _wantSpread = nextSpread;
      if (fontChanged) _pageSize = null;
    });
  }

  Future<void> _saveDisplay() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('vv_course_theme', _theme.name);
    await prefs.setDouble('vv_course_font', _fontScale);
    await prefs.setBool('vv_course_spread', _wantSpread);
  }

  @override
  void didUpdateWidget(covariant CourseBookPager oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.html != widget.html ||
        oldWidget.frontCoverUrl != widget.frontCoverUrl ||
        oldWidget.backCoverUrl != widget.backCoverUrl) {
      _pageSize = null;
      _pages = const [];
      _index = 0;
      _openExplains = {};
      _pendingExplainId = null;
    }
  }

  bool get _hasFrontCover {
    final value = widget.frontCoverUrl?.trim();
    return value != null && value.isNotEmpty;
  }

  bool get _hasBackCover {
    final value = widget.backCoverUrl?.trim();
    return value != null && value.isNotEmpty;
  }

  int get _coverShift => _hasFrontCover ? 1 : 0;

  bool _isCoverAt(int pageIndex) {
    if (pageIndex < 0 || pageIndex >= _pages.length) return false;
    final blocks = _pages[pageIndex];
    if (blocks.length != 1) return false;
    final id = blocks.first.id;
    return id == 'book-front-cover' || id == 'book-back-cover';
  }

  int _printedFor(int pageIndex) {
    if (_isCoverAt(pageIndex)) {
      if (pageIndex == 0 && _hasFrontCover) return widget.startPage;
      return widget.startPage +
          math.max(0, _pages.length - 1 - _coverShift - (_hasBackCover ? 1 : 0));
    }
    return widget.startPage + pageIndex - _coverShift;
  }

  List<List<CourseHtmlBlock>> _withCoverPages(List<List<CourseHtmlBlock>> pages) {
    var next = pages;
    if (_hasFrontCover) {
      next = [
        [
          CourseHtmlBlock(
            CourseHtmlKind.image,
            'Front cover',
            src: widget.frontCoverUrl!.trim(),
            id: 'book-front-cover',
          ),
        ],
        ...next,
      ];
    }
    if (_hasBackCover) {
      next = [
        ...next,
        [
          CourseHtmlBlock(
            CourseHtmlKind.image,
            'Back cover',
            src: widget.backCoverUrl!.trim(),
            id: 'book-back-cover',
          ),
        ],
      ];
    }
    return next.isEmpty ? pages : next;
  }

  void _paginate(Size size, TextScaler scaler) {
    if (_holdPages && _pages.isNotEmpty) return;
    final snapped = Size(size.width.floorToDouble(), size.height.floorToDouble());
    if (_pageSize == snapped && _pages.isNotEmpty) return;
    final pages = paginateCourseBlocks(
      parseCourseHtml(widget.html),
      snapped.width,
      snapped.height,
      textScaler: scaler,
      openExplains: _openExplains,
    );
    _pageSize = snapped;
    _pages = _withCoverPages(pages.isEmpty ? [<CourseHtmlBlock>[]] : pages);
    _index = _index.clamp(0, math.max(0, _pages.length - 1)).toInt();
    final explainId = _pendingExplainId;
    if (explainId != null && explainId.isNotEmpty) {
      final found = _pages.indexWhere((page) => page.any((block) => block.id == explainId));
      if (found >= 0) {
        _pendingIndex = found;
        _pendingExplainId = null;
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tryJumpPending();
      _tryJumpAnchor();
    });
  }

  void _toggleExplain(String id) {
    if (id.isEmpty) return;
    setState(() {
      final next = {..._openExplains};
      if (!next.remove(id)) next.add(id);
      _openExplains = next;
      _pendingExplainId = id;
      _pageSize = null;
    });
  }

  void goToPrintedPage(int printed) {
    _pendingIndex = printed - widget.startPage + _coverShift;
    _pendingAnchor = null;
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryJumpPending());
  }

  void flashQuote(String quote) {
    final text = quote.trim();
    if (text.length < 2) return;
    setState(() => _quoteNeedle = text);
  }

  void goToAnchor(String anchor) {
    _pendingAnchor = anchor.trim();
    _pendingIndex = null;
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryJumpAnchor());
  }

  int _pageIndexForAnchor(String anchor) {
    final folded = _foldSearch(anchor);
    if (folded.length < 2) return -1;
    for (var i = 0; i < _pages.length; i++) {
      for (final block in _pages[i]) {
        if (!_isHeading(block.kind)) continue;
        final heading = _foldSearch(block.text);
        if (heading.isEmpty) continue;
        if (heading == folded) return i;
        if (folded.length >= 8 && heading.contains(folded)) return i;
        if (heading.length >= 8 && folded.contains(heading)) return i;
      }
    }
    for (var i = 0; i < _pages.length; i++) {
      for (final block in _pages[i]) {
        if (_foldSearch(block.text) == folded) return i;
      }
    }
    final first = folded.split(' ').firstWhere((part) => part.isNotEmpty, orElse: () => '');
    if (first.length >= 2 && first.length <= 4 && !folded.contains(' ')) {
      for (var i = 0; i < _pages.length; i++) {
        for (final block in _pages[i]) {
          if (!_isHeading(block.kind)) continue;
          if (_foldSearch(block.text).split(' ').any((word) => word.startsWith(first))) return i;
        }
      }
    }
    return -1;
  }

  void _tryJumpAnchor({int attempt = 0}) {
    final anchor = _pendingAnchor;
    if (!mounted || anchor == null || anchor.isEmpty) return;
    final index = _pageIndexForAnchor(anchor);
    if (index < 0 || !_controller.hasClients) {
      if (attempt < 24) {
        Future<void>.delayed(Duration(milliseconds: 24 + attempt * 12), () {
          if (mounted) _tryJumpAnchor(attempt: attempt + 1);
        });
      }
      return;
    }
    _pendingAnchor = null;
    _pendingIndex = index;
    _jumpNow(index);
  }

  void _tryJumpPending({int attempt = 0}) {
    final index = _pendingIndex;
    if (!mounted || index == null) return;
    if (index < 0) {
      _pendingIndex = null;
      return;
    }
    if (_pages.isEmpty || index >= _pages.length || !_controller.hasClients) {
      if (attempt < 24) {
        Future<void>.delayed(Duration(milliseconds: 24 + attempt * 12), () {
          if (mounted) _tryJumpPending(attempt: attempt + 1);
        });
      }
      return;
    }
    _jumpNow(index);
    final dest = _controllerIndexFor(index);
    if ((_controller.page?.round() ?? dest) != dest && attempt < 24) {
      Future<void>.delayed(const Duration(milliseconds: 40), () {
        if (mounted) _tryJumpPending(attempt: attempt + 1);
      });
      return;
    }
    _pendingIndex = null;
  }

  bool get _spread {
    if (!mounted) return false;
    return _wantSpread && courseOpenBookLayout(MediaQuery.sizeOf(context));
  }

  List<({int? left, int? right})> get _spreads =>
      courseSpreads(_pages.length, widget.startPage);

  int _controllerIndexFor(int pageIndex) {
    if (!_spread) return pageIndex;
    final i = _spreads.indexWhere((s) => s.left == pageIndex || s.right == pageIndex);
    return i < 0 ? 0 : i;
  }

  void _jumpNow(int index) {
    if (index < 0 || (_pages.isNotEmpty && index >= _pages.length)) return;
    final dest = _controllerIndexFor(index);
    if (_controller.hasClients) {
      _controller.jumpToPage(dest);
    }
    if (_index != index) setState(() => _index = index);
  }

  void _goTo(int index) {
    _pendingIndex = index;
    _tryJumpPending();
  }

  void _turnSpread(int delta) {
    if (!_spread) {
      _goTo((_index + delta).clamp(0, math.max(0, _pages.length - 1)).toInt());
      return;
    }
    final spreads = _spreads;
    final current = _controllerIndexFor(_index);
    final nextAt = (current + delta).clamp(0, math.max(0, spreads.length - 1)).toInt();
    final next = spreads[nextAt];
    _goTo(next.left ?? next.right ?? 0);
  }

  static const _searchStops = {
    'a',
    'an',
    'the',
    'of',
    'in',
    'on',
    'to',
    'for',
    'and',
    'or',
    'is',
    'are',
    'was',
    'be',
    'by',
    'at',
    'as',
    'it',
    'if',
  };

  String _foldSearch(String value) {
    return value
        .replaceAll(RegExp(r'[\u2018\u2019\u201A]'), "'")
        .replaceAll(RegExp(r'[\u201C\u201D\u201E]'), '"')
        .toLowerCase()
        .replaceAll(RegExp(r'[^\p{L}\p{N}]+', unicode: true), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  List<String> _searchWords(String folded) {
    return folded
        .split(' ')
        .where((part) => part.length >= 2 && !_searchStops.contains(part))
        .toList();
  }

  bool _phraseMatches(String hay, String needle) {
    if (needle.isEmpty || hay.isEmpty) return false;
    final hayParts = hay.split(' ').where((part) => part.isNotEmpty).toList();
    if (!needle.contains(' ')) {
      if (needle.length <= 3) {
        return hayParts.any((part) => part.startsWith(needle));
      }
      return hayParts.contains(needle);
    }
    if (hay.contains(needle)) return true;
    final words = _searchWords(needle);
    if (words.isEmpty) return false;
    final hayWords = _searchWords(hay);
    var j = 0;
    for (final word in hayWords) {
      if (j < words.length && word == words[j]) j++;
    }
    return j == words.length;
  }

  String _clipSnippet(String text) {
    final snippet = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (snippet.length <= 110) return snippet;
    return '${snippet.substring(0, 107).trim()}…';
  }

  List<({String title, int level, int page})> _toc() {
    final out = <({String title, int level, int page})>[];
    for (var i = 0; i < _pages.length; i++) {
      for (final block in _pages[i]) {
        final level = switch (block.kind) {
          CourseHtmlKind.h1 => 1,
          CourseHtmlKind.h2 => 2,
          CourseHtmlKind.h3 => 3,
          _ => 0,
        };
        if (_isCoverAt(i) || level == 0 || block.text.trim().isEmpty) continue;
        out.add((title: block.text.trim(), level: level, page: _printedFor(i)));
      }
    }
    if (out.isEmpty && widget.chapterTitle.trim().isNotEmpty) {
      out.add((title: widget.chapterTitle.trim(), level: 1, page: widget.startPage));
    }
    return out;
  }

  ({int current, int total, String title}) _readingProgress() {
    final items = _toc();
    if (items.isEmpty) {
      return (
        current: _index + 1,
        total: math.max(_pages.length, 1),
        title: widget.chapterTitle,
      );
    }
    final printed = _printedFor(_index);
    var current = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].page <= printed) current = i;
    }
    return (current: current + 1, total: items.length, title: items[current].title);
  }

  List<({String snippet, int page, String anchor, int index})> _search(String query) {
    final needle = _foldSearch(query);
    if (needle.length < 2) return const [];
    final hits = <({String snippet, int page, String anchor, int index})>[];
    final seen = <String>{};
    for (final item in _toc()) {
      final title = item.title.trim();
      if (title.isEmpty) continue;
      if (!_phraseMatches(_foldSearch(title), needle)) continue;
      if (!seen.add(_foldSearch(title))) continue;
      hits.add((
        snippet: title,
        page: item.page,
        anchor: title,
        index: (item.page - widget.startPage + _coverShift).clamp(0, math.max(0, _pages.length - 1)).toInt(),
      ));
    }
    for (var i = 0; i < _pages.length; i++) {
      if (_isCoverAt(i)) continue;
      if (!needle.contains(' ') && needle.length <= 3) break;
      CourseHtmlBlock? best;
      for (final block in _pages[i]) {
        if (_isHeading(block.kind)) continue;
        final chunks = [block.text, if ((block.caption ?? '').trim().isNotEmpty) block.caption!];
        for (final chunk in chunks) {
          if (chunk.trim().isEmpty) continue;
          if (!_phraseMatches(_foldSearch(chunk), needle)) continue;
          best = block;
          break;
        }
        if (best != null) break;
      }
      if (best == null) continue;
      final anchor = best.text.trim();
      if (!seen.add(_foldSearch(anchor))) continue;
      hits.add((
        snippet: _clipSnippet(anchor),
        page: _printedFor(i),
        anchor: anchor,
        index: i,
      ));
    }
    return hits;
  }

  List<CourseHighlightMark> _searchMarks() {
    return [
      if (_searchNeedle.trim().length >= 2)
        CourseHighlightMark(text: _searchNeedle.trim(), color: '#9EE7FF', wholeWord: true),
      if (_quoteNeedle.trim().length >= 2)
        CourseHighlightMark(text: _quoteNeedle.trim(), color: '#CDE8C5', wholeWord: false),
    ];
  }

  void _openContents() {
    final items = _toc();
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text('Contents', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            if (items.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No headings in this chapter yet.'),
              ),
            for (final item in items)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.fromLTRB(8.0 + (item.level - 1) * 16, 0, 8, 0),
                title: Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: Text('p.${item.page}', style: const TextStyle(color: AuthTheme.mutedBrown)),
                onTap: () {
                  Navigator.pop(ctx);
                  goToAnchor(item.title);
                },
              ),
          ],
        );
      },
    );
  }

  Future<void> _openSearch() async {
    _holdPages = true;
    final chosen = await showModalBottomSheet<
        ({
          ({String snippet, int page, String anchor, int index}) hit,
          String query,
        })>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.72,
            minChildSize: 0.45,
            maxChildSize: 0.95,
            builder: (context, scroll) {
              return _ChapterSearchSheet(
                scrollController: scroll,
                initialQuery: _searchNeedle,
                onSearch: _search,
                onOpenPage: (hit, query) => Navigator.pop(ctx, (hit: hit, query: query)),
              );
            },
          ),
        );
      },
    );
    _holdPages = false;
    if (!mounted || chosen == null) return;
    final title = chosen.hit.anchor.trim();
    final typed = chosen.query.trim().isNotEmpty ? chosen.query.trim() : title;
    setState(() {
      _searchNeedle = typed;
    });
    await Future<void>.delayed(const Duration(milliseconds: 220));
    if (!mounted) return;
    goToAnchor(title);
  }

  void _openDisplay() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheet) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Reading', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 14),
                  const Text('Paper', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      for (final theme in CoursePaperTheme.values)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(switch (theme) {
                              CoursePaperTheme.paper => 'Paper',
                              CoursePaperTheme.sepia => 'Sepia',
                              CoursePaperTheme.night => 'Night',
                            }),
                            selected: _theme == theme,
                            onSelected: (_) {
                              setState(() => _theme = theme);
                              setSheet(() {});
                              _saveDisplay();
                            },
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text('Text size', style: TextStyle(fontWeight: FontWeight.w600)),
                  Row(
                    children: [
                      TextButton(
                        onPressed: _fontScale <= 0.86
                            ? null
                            : () {
                                setState(() {
                                  _fontScale = (_fontScale - 0.1).clamp(0.85, 1.35);
                                  _pageSize = null;
                                  _pages = const [];
                                });
                                setSheet(() {});
                                _saveDisplay();
                              },
                        child: const Text('A-', style: TextStyle(fontSize: 16)),
                      ),
                      Expanded(
                        child: Text(
                          '${(_fontScale * 100).round()}%',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AuthTheme.mutedBrown),
                        ),
                      ),
                      TextButton(
                        onPressed: _fontScale >= 1.34
                            ? null
                            : () {
                                setState(() {
                                  _fontScale = (_fontScale + 0.1).clamp(0.85, 1.35);
                                  _pageSize = null;
                                  _pages = const [];
                                });
                                setSheet(() {});
                                _saveDisplay();
                              },
                        child: const Text('A+', style: TextStyle(fontSize: 22)),
                      ),
                    ],
                  ),
                  if (courseOpenBookLayout(MediaQuery.sizeOf(this.context))) ...[
                    const SizedBox(height: 16),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Open book'),
                      subtitle: const Text('Two pages at a time on tablet and web-sized screens'),
                      value: _wantSpread,
                      onChanged: (value) {
                        setState(() {
                          _wantSpread = value;
                          _pageSize = null;
                        });
                        setSheet(() {});
                        _saveDisplay();
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) _jumpNow(_index);
                        });
                      },
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _openBookmarks() {
    final pages = widget.bookmarkTypes.keys.toList()..sort();
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text('Bookmarks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            if (pages.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Tap the ribbon on a page to bookmark it as Important, Doubt, or Revise.'),
              ),
            for (final page in pages)
              ListTile(
                leading: Icon(Icons.bookmark, color: bookmarkRibbonColor(widget.bookmarkTypes[page])),
                title: Text('Page $page'),
                subtitle: Text(bookmarkTypeLabel(widget.bookmarkTypes[page])),
                trailing: widget.onRemoveBookmark == null
                    ? null
                    : IconButton(
                        tooltip: 'Remove',
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          Navigator.pop(ctx);
                          widget.onRemoveBookmark!(page);
                        },
                      ),
                onTap: () {
                  Navigator.pop(ctx);
                  goToPrintedPage(page);
                },
              ),
          ],
        );
      },
    );
  }

  CourseQuickCheckItem? _quickForPrinted() {
    if (widget.quickChecks.isEmpty) return null;
    final printedPages = _visiblePrinted;
    for (final item in widget.quickChecks) {
      if (item.pageNumber != null && printedPages.contains(item.pageNumber)) return item;
    }
    final last = widget.startPage +
        math.max(0, _pages.length - 1 - _coverShift - (_hasBackCover ? 1 : 0));
    if (printedPages.contains(last)) {
      for (final item in widget.quickChecks) {
        if (item.pageNumber == null) return item;
      }
    }
    return null;
  }

  List<int> get _visiblePrinted {
    if (!_spread) return _isCoverAt(_index) ? const [] : [_printedFor(_index)];
    final pair = _spreads[_controllerIndexFor(_index)];
    return [
      if (pair.left != null && !_isCoverAt(pair.left!)) _printedFor(pair.left!),
      if (pair.right != null && !_isCoverAt(pair.right!)) _printedFor(pair.right!),
    ];
  }

  void _openQuickCheck([CourseQuickCheckItem? item]) {
    final check = item ?? _quickForPrinted() ?? (widget.quickChecks.isEmpty ? null : widget.quickChecks.first);
    if (check == null) {
      widget.onOpenQuickCheck?.call();
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
          child: SingleChildScrollView(child: CourseQuickCheckView(item: check)),
        );
      },
    );
  }

  void _openFlashcards() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
          child: SingleChildScrollView(
            child: CourseFlashcardDeck(
              cards: widget.flashcards,
              onDelete: widget.onDeleteFlashcard,
            ),
          ),
        );
      },
    );
  }

  void _openProgress() {
    final items = _toc();
    final progress = _readingProgress();
    final printed = _printedFor(_index);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            const Text('Progress', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              items.isEmpty
                  ? 'Page ${progress.current} of ${progress.total}'
                  : 'Topic ${progress.current} of ${progress.total}',
              style: const TextStyle(color: AuthTheme.mutedBrown, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: progress.total <= 0 ? 0 : progress.current / progress.total,
              color: AuthTheme.brown,
              backgroundColor: AuthTheme.brown.withValues(alpha: 0.15),
            ),
            const SizedBox(height: 6),
            Text(progress.title, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            if (items.isEmpty)
              const Text('No section headings in this chapter yet.', style: TextStyle(color: AuthTheme.mutedBrown))
            else
              for (var i = 0; i < items.length; i++)
                ListTile(
                  contentPadding: EdgeInsets.fromLTRB(8.0 + (items[i].level - 1) * 12, 0, 8, 0),
                  leading: Icon(
                    items[i].page <= printed ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: items[i].page <= printed ? AuthTheme.brown : AuthTheme.mutedBrown,
                    size: 20,
                  ),
                  title: Text(
                    items[i].title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: i + 1 == progress.current ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                  trailing: Text('p.${items[i].page}', style: const TextStyle(color: AuthTheme.mutedBrown)),
                  onTap: () {
                    Navigator.pop(ctx);
                    goToAnchor(items[i].title);
                  },
                ),
          ],
        );
      },
    );
  }

  void _onReaderMenu(String value) {
    switch (value) {
      case 'contents':
        _openContents();
      case 'search':
        _openSearch();
      case 'highlights':
        widget.onOpenHighlights?.call();
      case 'notes':
        widget.onOpenNotes?.call();
      case 'bookmarks':
        _openBookmarks();
      case 'display':
        _openDisplay();
      case 'progress':
        _openProgress();
      case 'practice':
        widget.onOpenPractice?.call();
      case 'chapters':
        widget.onOpenChapters?.call();
      case 'check':
        _openQuickCheck();
      case 'cards':
        _openFlashcards();
    }
  }

  PopupMenuItem<String> _menuItem(String value, IconData icon, String label) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Icon(icon, color: AuthTheme.brown, size: 22),
          const SizedBox(width: 12),
          Expanded(child: Text(label)),
        ],
      ),
    );
  }

  Widget _buildPaperPage(int pageIndex, {required bool verso}) {
    final printed = _printedFor(pageIndex);
    final cover = _isCoverAt(pageIndex);
    final blocks = pageIndex < _pages.length ? _pages[pageIndex] : const <CourseHtmlBlock>[];
    return _PaperPage(
      key: ValueKey('paper-$printed-$verso-$cover'),
      header: widget.runningHeader,
      chapterTitle: widget.chapterTitle,
      blocks: blocks,
      printedPage: printed,
      verso: verso,
      isCover: cover,
      coverSrc: cover ? blocks.first.src : null,
      highlights: [
        ...widget.highlights,
        ..._searchMarks(),
      ],
      inkColor: _ink,
      palette: CoursePaperPalette.of(_theme),
      bookmarked: !cover && widget.bookmarkTypes.containsKey(printed),
      markType: cover ? null : widget.bookmarkTypes[printed],
      onPickInk: (color) => setState(() => _ink = color),
      onHighlight: cover ? null : widget.onHighlight,
      onRemoveHighlight: cover ? null : widget.onRemoveHighlight,
      onNote: cover ? null : widget.onNote,
      onAddFlashcard: cover ? null : widget.onAddFlashcard,
      onSetBookmark: cover || widget.onSetBookmark == null ? null : (type) => widget.onSetBookmark!(printed, type),
      onRemoveBookmark: cover || widget.onRemoveBookmark == null ? null : () => widget.onRemoveBookmark!(printed),
      openExplains: _openExplains,
      onToggleExplain: _toggleExplain,
    );
  }

  Widget _blankLeaf(CoursePaperPalette palette) {
    return ColoredBox(color: palette.paper);
  }

  @override
  Widget build(BuildContext context) {
    final scaler = TextScaler.linear(_fontScale);
    final total = _pages.length;
    final palette = CoursePaperPalette.of(_theme);
    final progress = _readingProgress();
    final topicCount = _toc().length;
    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.16),
                        blurRadius: 16,
                        offset: const Offset(3, 6),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final spread = _spread;
                        if (spread != _lastSpread) {
                          _lastSpread = spread;
                          _pageSize = null;
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) _jumpNow(_index);
                          });
                        }
                        const ratio = 297 / 210;
                        const gutter = 14.0;
                        final pairPreview = spread
                            ? _spreads[_controllerIndexFor(_index)]
                            : (left: _index, right: _index);
                        final solo = !spread || pairPreview.left == null || pairPreview.right == null;
                        final leaves = spread && !solo ? 2 : 1;
                        var leafH = constraints.maxHeight;
                        var leafW = spread ? leafH / ratio : constraints.maxWidth;
                        if (spread) {
                          if (leafW * leaves + (leaves == 2 ? gutter : 0) > constraints.maxWidth) {
                            leafW = (constraints.maxWidth - (leaves == 2 ? gutter : 0)) / leaves;
                            leafH = leafW * ratio;
                          }
                        } else {
                          leafW = constraints.maxWidth;
                          leafH = constraints.maxHeight;
                        }
                        final body = Size(
                          (leafW - _paperPad.horizontal - 10).clamp(100, 2000).toDouble(),
                          (leafH - _paperPad.vertical - _headerChrome - _folioChrome).clamp(80, 4000).toDouble(),
                        );
                        _paginate(body, scaler);
                        final spreads = _spreads;
                        Widget leaf(int? pageIndex, {required bool verso}) {
                          if (pageIndex == null) return _blankLeaf(palette);
                          return SizedBox(
                            width: leafW,
                            height: leafH,
                            child: _buildPaperPage(pageIndex, verso: verso),
                          );
                        }

                        return MediaQuery(
                          data: MediaQuery.of(context).copyWith(textScaler: scaler),
                          child: PageView.builder(
                            controller: _controller,
                            itemCount: spread ? math.max(spreads.length, 1) : math.max(_pages.length, 1),
                            onPageChanged: (i) {
                              if (spread) {
                                final pair = spreads[i.clamp(0, math.max(0, spreads.length - 1)).toInt()];
                                final pageIndex = pair.left ?? pair.right ?? 0;
                                setState(() => _index = pageIndex);
                                widget.onPageChanged?.call(
                                  pageIndex,
                                  _pages.length,
                                  _printedFor(pageIndex),
                                );
                              } else {
                                setState(() => _index = i);
                                widget.onPageChanged?.call(
                                  i,
                                  _pages.length,
                                  _printedFor(i),
                                );
                              }
                            },
                            itemBuilder: (context, i) {
                              if (!spread) {
                                return _buildPaperPage(i, verso: false);
                              }
                              final pair = spreads[i.clamp(0, math.max(0, spreads.length - 1)).toInt()];
                              if (pair.left == null || pair.right == null) {
                                return Center(
                                  child: leaf(pair.left ?? pair.right, verso: false),
                                );
                              }
                              return Center(
                                child: SizedBox(
                                  width: leafW * 2 + gutter,
                                  height: leafH,
                                  child: Row(
                                    children: [
                                      leaf(pair.left, verso: true),
                                      SizedBox(
                                        width: gutter,
                                        height: leafH,
                                        child: DecoratedBox(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                Colors.black.withValues(alpha: 0.12),
                                                Colors.black.withValues(alpha: 0.38),
                                                const Color(0x33FFF1D0),
                                                Colors.black.withValues(alpha: 0.38),
                                                Colors.black.withValues(alpha: 0.12),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                      leaf(pair.right, verso: false),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
              if (_searchNeedle.isNotEmpty ||
                  _quoteNeedle.isNotEmpty ||
                  _quickForPrinted() != null ||
                  widget.flashcards.isNotEmpty)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 8,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_searchNeedle.isNotEmpty || _quoteNeedle.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              if (_searchNeedle.isNotEmpty)
                                InputChip(
                                  avatar: const Icon(Icons.search, size: 18),
                                  label: Text(_searchNeedle, maxLines: 1, overflow: TextOverflow.ellipsis),
                                  onDeleted: () => setState(() => _searchNeedle = ''),
                                  onPressed: _openSearch,
                                ),
                              if (_quoteNeedle.isNotEmpty)
                                InputChip(
                                  avatar: const Icon(Icons.format_quote, size: 18),
                                  label: Text(_quoteNeedle, maxLines: 1, overflow: TextOverflow.ellipsis),
                                  onDeleted: () => setState(() => _quoteNeedle = ''),
                                ),
                            ],
                          ),
                        ),
                      if (_quickForPrinted() != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Material(
                            color: const Color(0xFFFFF6C8),
                            elevation: 2,
                            borderRadius: BorderRadius.circular(12),
                            child: ListTile(
                              dense: true,
                              leading: const Icon(Icons.task_alt, color: AuthTheme.green),
                              title: const Text('Quick check', style: TextStyle(fontWeight: FontWeight.w800)),
                              subtitle: Text(
                                _quickForPrinted()!.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              trailing: const Icon(Icons.expand_less),
                              onTap: () => _openQuickCheck(_quickForPrinted()),
                            ),
                          ),
                        ),
                      if (widget.flashcards.isNotEmpty)
                        Material(
                          color: const Color(0xFFE8F4EA),
                          elevation: 2,
                          borderRadius: BorderRadius.circular(12),
                          child: ListTile(
                            dense: true,
                            leading: const Icon(Icons.style_outlined, color: AuthTheme.green),
                            title: const Text('Flashcards', style: TextStyle(fontWeight: FontWeight.w800)),
                            subtitle: Text(
                              '${widget.flashcards.length} card${widget.flashcards.length == 1 ? '' : 's'} from this chapter',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: const Icon(Icons.expand_less),
                            onTap: _openFlashcards,
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: SizedBox(
            height: 58,
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Previous page',
                  onPressed: (_spread ? _controllerIndexFor(_index) <= 0 : _index <= 0)
                      ? null
                      : () => _turnSpread(-1),
                  icon: const Icon(Icons.chevron_left),
                  color: AuthTheme.brown,
                ),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        total == 0
                            ? ''
                            : _spread
                                ? '${_visiblePrinted.join('–')} · $total pages'
                                : '${_index + 1} / $total',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          letterSpacing: 0.4,
                          color: AuthTheme.mutedBrown,
                        ),
                      ),
                      if (topicCount > 0)
                        Text(
                          'Topic ${progress.current} of ${progress.total}',
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, color: AuthTheme.mutedBrown),
                        ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'More',
                  icon: const Icon(Icons.more_vert, color: AuthTheme.brown),
                  onSelected: _onReaderMenu,
                  itemBuilder: (context) => [
                    _menuItem('contents', Icons.list_alt_outlined, 'Contents'),
                    _menuItem('search', Icons.search, 'Search'),
                    _menuItem('highlights', Icons.highlight_outlined, 'Highlights'),
                    _menuItem('notes', Icons.sticky_note_2_outlined, 'Notes'),
                    _menuItem('bookmarks', Icons.bookmark_outline, 'Bookmarks'),
                    _menuItem('progress', Icons.flag_outlined, 'Progress'),
                    _menuItem('display', Icons.text_fields, 'Display'),
                    if (widget.onOpenPractice != null)
                      _menuItem('practice', Icons.quiz_outlined, 'Practice'),
                    if (widget.quickChecks.isNotEmpty || widget.onOpenQuickCheck != null)
                      _menuItem('check', Icons.task_alt_outlined, 'Quick check'),
                    _menuItem('cards', Icons.style_outlined, 'Flashcards'),
                    if (widget.onOpenChapters != null)
                      _menuItem('chapters', Icons.menu_book_outlined, 'Chapters'),
                  ],
                ),
                IconButton(
                  tooltip: 'Next page',
                  onPressed: total == 0 ||
                          (_spread
                              ? _controllerIndexFor(_index) >= _spreads.length - 1
                              : _index >= total - 1)
                      ? null
                      : () => _turnSpread(1),
                  icon: const Icon(Icons.chevron_right),
                  color: AuthTheme.brown,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PaperPage extends StatefulWidget {
  const _PaperPage({
    super.key,
    required this.header,
    required this.chapterTitle,
    required this.blocks,
    required this.printedPage,
    this.verso = false,
    this.highlights = const [],
    this.inkColor = '#FFE66D',
    this.palette = const CoursePaperPalette(
      paper: _paper,
      rule: _rule,
      text: AuthTheme.brown,
      muted: AuthTheme.mutedBrown,
      spine: _spine,
    ),
    this.bookmarked = false,
    this.markType,
    this.onPickInk,
    this.onHighlight,
    this.onRemoveHighlight,
    this.onNote,
    this.onAddFlashcard,
    this.onSetBookmark,
    this.onRemoveBookmark,
    this.openExplains = const <String>{},
    this.onToggleExplain,
    this.isCover = false,
    this.coverSrc,
  });

  final String header;
  final String chapterTitle;
  final List<CourseHtmlBlock> blocks;
  final int printedPage;
  final bool verso;
  final List<CourseHighlightMark> highlights;
  final String inkColor;
  final CoursePaperPalette palette;
  final bool bookmarked;
  final String? markType;
  final void Function(String color)? onPickInk;
  final void Function(String text, String color)? onHighlight;
  final void Function(String text)? onRemoveHighlight;
  final void Function(String text)? onNote;
  final void Function(String text)? onAddFlashcard;
  final void Function(String markType)? onSetBookmark;
  final VoidCallback? onRemoveBookmark;
  final Set<String> openExplains;
  final void Function(String id)? onToggleExplain;
  final bool isCover;
  final String? coverSrc;

  @override
  State<_PaperPage> createState() => _PaperPageState();
}

class _PaperPageState extends State<_PaperPage> with AutomaticKeepAliveClientMixin {
  String _selected = '';

  @override
  bool get wantKeepAlive => true;

  void _useSelection(void Function(String text) action) {
    final text = _selected.trim();
    if (text.length < 2) return;
    action(text);
    setState(() => _selected = '');
  }

  Future<void> _pickBookmarkType() async {
    if (widget.onSetBookmark == null) return;
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Bookmark this page', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
              ),
              for (final type in const ['important', 'doubt', 'revise'])
                ListTile(
                  leading: Icon(Icons.bookmark, color: bookmarkRibbonColor(type)),
                  title: Text(bookmarkTypeLabel(type)),
                  selected: widget.bookmarked && normalizeBookmarkType(widget.markType) == type,
                  onTap: () => Navigator.pop(ctx, type),
                ),
              if (widget.bookmarked && widget.onRemoveBookmark != null)
                ListTile(
                  leading: const Icon(Icons.bookmark_remove_outlined),
                  title: const Text('Remove bookmark'),
                  onTap: () => Navigator.pop(ctx, 'remove'),
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
    if (!mounted || choice == null) return;
    if (choice == 'remove') {
      widget.onRemoveBookmark?.call();
      return;
    }
    widget.onSetBookmark!(choice);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final showBar = _selected.trim().length >= 2;
    final palette = widget.palette;
    final coverSrc = widget.coverSrc;
    if (widget.isCover && coverSrc != null && coverSrc.trim().isNotEmpty) {
      return ColoredBox(
        color: const Color(0xFF1A120C),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              child: CourseNetworkImage(
                src: coverSrc,
                fill: true,
                fit: BoxFit.cover,
              ),
            ),
            Positioned(
              left: widget.verso ? null : 0,
              right: widget.verso ? 0 : null,
              top: 0,
              bottom: 0,
              width: 12,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: widget.verso ? Alignment.centerRight : Alignment.centerLeft,
                    end: widget.verso ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [palette.spine, Colors.transparent],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }
    return ColoredBox(
      color: palette.paper,
      child: Stack(
        children: [
          Positioned(
            left: widget.verso ? null : 0,
            right: widget.verso ? 0 : null,
            top: 0,
            bottom: 0,
            width: 12,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: widget.verso ? Alignment.centerRight : Alignment.centerLeft,
                  end: widget.verso ? Alignment.centerLeft : Alignment.centerRight,
                  colors: [palette.spine, Colors.transparent],
                ),
              ),
            ),
          ),
          Padding(
            padding: _paperPad,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.header.toUpperCase(),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 9,
                    letterSpacing: 1.4,
                    fontWeight: FontWeight.w600,
                    color: palette.muted,
                  ),
                ),
                const SizedBox(height: 3),
                Padding(
                  padding: EdgeInsets.only(left: widget.verso ? 28 : 0, right: widget.verso ? 0 : 28),
                  child: Text(
                    widget.chapterTitle,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      color: palette.text,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 8, bottom: 10),
                  child: Divider(height: 1, thickness: 0.7, color: palette.rule),
                ),
                Expanded(
                  child: ClipRect(
                    child: SelectionArea(
                      onSelectionChanged: (content) {
                        final next = content?.plainText ?? '';
                        if (next == _selected) return;
                        setState(() => _selected = next);
                      },
                      contextMenuBuilder: (context, state) {
                        final selected = _selected.trim();
                        final canRemove = selected.length >= 2 &&
                            widget.onRemoveHighlight != null &&
                            widget.highlights.any((h) => highlightOverlaps(h.text, selected));
                        return AdaptiveTextSelectionToolbar.buttonItems(
                          anchors: state.contextMenuAnchors,
                          buttonItems: [
                            ...state.contextMenuButtonItems,
                            if (selected.length >= 2 && widget.onHighlight != null)
                              ContextMenuButtonItem(
                                label: 'Highlight',
                                onPressed: () {
                                  ContextMenuController.removeAny();
                                  _useSelection((text) => widget.onHighlight!(text, widget.inkColor));
                                },
                              ),
                            if (canRemove)
                              ContextMenuButtonItem(
                                label: 'Remove highlight',
                                onPressed: () {
                                  ContextMenuController.removeAny();
                                  _useSelection(widget.onRemoveHighlight!);
                                },
                              ),
                            if (widget.onNote != null)
                              ContextMenuButtonItem(
                                label: 'Add note',
                                onPressed: () {
                                  ContextMenuController.removeAny();
                                  final quote = _selected.trim();
                                  widget.onNote!(quote);
                                },
                              ),
                            if (widget.onAddFlashcard != null)
                              ContextMenuButtonItem(
                                label: 'Flashcard',
                                onPressed: () {
                                  ContextMenuController.removeAny();
                                  final quote = _selected.trim();
                                  widget.onAddFlashcard!(quote);
                                },
                              ),
                          ],
                        );
                      },
                      child: SingleChildScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (var i = 0; i < widget.blocks.length; i++)
                              CourseHtmlBlockView(
                                block: widget.blocks[i],
                                firstOnPage: i == 0,
                                imageHeight: 220,
                                highlights: widget.highlights,
                                ink: palette.text,
                                muted: palette.muted,
                                openExplains: widget.openExplains,
                                onToggleExplain: widget.onToggleExplain,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Divider(height: 1, thickness: 0.7, color: palette.rule),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    '${widget.printedPage}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 12,
                      letterSpacing: 0.6,
                      color: palette.muted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (widget.onSetBookmark != null)
            Positioned(
              top: 0,
              left: widget.verso ? 18 : null,
              right: widget.verso ? null : 18,
              child: _BookmarkRibbon(
                active: widget.bookmarked,
                color: bookmarkRibbonColor(widget.markType, active: widget.bookmarked),
                onTap: _pickBookmarkType,
              ),
            ),
          if (showBar)
            Positioned(
              left: 18,
              right: 18,
              bottom: 40,
              child: _SelectionStudyBar(
                inkColor: widget.inkColor,
                canRemove: widget.highlights.any((h) => highlightOverlaps(h.text, _selected)),
                onPickInk: (color) {
                  widget.onPickInk?.call(color);
                  final text = _selected.trim();
                  if (text.length >= 2) widget.onHighlight?.call(text, color);
                },
                onHighlight: widget.onHighlight == null
                    ? null
                    : () => _useSelection((text) => widget.onHighlight!(text, widget.inkColor)),
                onRemove: widget.onRemoveHighlight == null
                    ? null
                    : () => _useSelection(widget.onRemoveHighlight!),
                onNote: widget.onNote == null
                    ? null
                    : () {
                        final quote = _selected.trim();
                        widget.onNote!(quote);
                      },
                onFlashcard: widget.onAddFlashcard == null
                    ? null
                    : () {
                        final quote = _selected.trim();
                        widget.onAddFlashcard!(quote);
                      },
              ),
            ),
        ],
      ),
    );
  }
}

class _BookmarkRibbon extends StatelessWidget {
  const _BookmarkRibbon({
    required this.active,
    required this.onTap,
    required this.color,
  });

  final bool active;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: active ? 'Change or remove bookmark' : 'Bookmark this page',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.only(left: 10, bottom: 8),
          child: SizedBox(
            width: 26,
            height: active ? 56 : 36,
            child: CustomPaint(
              painter: _RibbonPainter(color: color),
            ),
          ),
        ),
      ),
    );
  }
}

Color bookmarkRibbonColor(String? type, {bool active = true}) {
  if (!active) return const Color(0x99C4A574);
  switch (normalizeBookmarkType(type)) {
    case 'doubt':
      return const Color(0xFF2B6CB0);
    case 'revise':
      return const Color(0xFF2D7A3E);
    default:
      return const Color(0xFFC4452D);
  }
}

class _RibbonPainter extends CustomPainter {
  const _RibbonPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height - 11)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(0, size.height - 11)
      ..close();
    canvas.drawShadow(path, Colors.black.withValues(alpha: 0.28), 3, false);
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawLine(
      Offset(size.width * 0.22, 4),
      Offset(size.width * 0.22, size.height - 16),
      Paint()
        ..color = Colors.white.withValues(alpha: 0.22)
        ..strokeWidth = 1.4,
    );
  }

  @override
  bool shouldRepaint(covariant _RibbonPainter oldDelegate) => oldDelegate.color != color;
}

class _SelectionStudyBar extends StatelessWidget {
  const _SelectionStudyBar({
    required this.inkColor,
    required this.canRemove,
    this.onPickInk,
    this.onHighlight,
    this.onRemove,
    this.onNote,
    this.onFlashcard,
  });

  final String inkColor;
  final bool canRemove;
  final void Function(String color)? onPickInk;
  final VoidCallback? onHighlight;
  final VoidCallback? onRemove;
  final VoidCallback? onNote;
  final VoidCallback? onFlashcard;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      color: const Color(0xFFFBF6EA),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 8, 6, 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final color in kHighlighterColors)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: GestureDetector(
                      onTap: onPickInk == null ? null : () => onPickInk!(color),
                      child: Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          color: parseHighlightColor(color).withValues(alpha: 1),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: inkColor.toUpperCase() == color
                                ? AuthTheme.brown
                                : Colors.black.withValues(alpha: 0.18),
                            width: inkColor.toUpperCase() == color ? 2.4 : 1,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            Wrap(
              alignment: WrapAlignment.center,
              children: [
                if (onHighlight != null)
                  TextButton.icon(
                    onPressed: onHighlight,
                    icon: Icon(Icons.highlight, color: parseHighlightColor(inkColor).withValues(alpha: 1)),
                    label: const Text('Highlight'),
                    style: TextButton.styleFrom(foregroundColor: AuthTheme.brown),
                  ),
                if (canRemove && onRemove != null)
                  TextButton.icon(
                    onPressed: onRemove,
                    icon: const Icon(Icons.format_color_reset_outlined),
                    label: const Text('Remove'),
                    style: TextButton.styleFrom(foregroundColor: AuthTheme.brown),
                  ),
                if (onNote != null)
                  TextButton.icon(
                    onPressed: onNote,
                    icon: const Icon(Icons.sticky_note_2_outlined),
                    label: const Text('Note'),
                    style: TextButton.styleFrom(foregroundColor: AuthTheme.brown),
                  ),
                if (onFlashcard != null)
                  TextButton.icon(
                    onPressed: onFlashcard,
                    icon: const Icon(Icons.style_outlined),
                    label: const Text('Card'),
                    style: TextButton.styleFrom(foregroundColor: AuthTheme.brown),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ChapterSearchSheet extends StatefulWidget {
  const _ChapterSearchSheet({
    required this.onSearch,
    required this.onOpenPage,
    this.scrollController,
    this.initialQuery = '',
  });

  final List<({String snippet, int page, String anchor, int index})> Function(String query) onSearch;
  final void Function(({String snippet, int page, String anchor, int index}) hit, String query) onOpenPage;
  final ScrollController? scrollController;
  final String initialQuery;

  @override
  State<_ChapterSearchSheet> createState() => _ChapterSearchSheetState();
}

class _ChapterSearchSheetState extends State<_ChapterSearchSheet> {
  late final TextEditingController _controller;
  List<({String snippet, int page, String anchor, int index})> _hits = const [];
  var _didSearch = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
    if (widget.initialQuery.trim().length >= 2) {
      _didSearch = true;
      _hits = widget.onSearch(widget.initialQuery);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _run(String value) {
    FocusScope.of(context).unfocus();
    setState(() {
      _didSearch = true;
      _hits = widget.onSearch(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      controller: widget.scrollController,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Search in chapter', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                TextField(
                  controller: _controller,
                  autofocus: true,
                  textInputAction: TextInputAction.search,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: _run,
                  decoration: InputDecoration(
                    hintText: 'Find a word or phrase',
                    prefixIcon: const Icon(Icons.search),
                    border: const OutlineInputBorder(),
                    suffixIcon: _controller.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Clear search',
                            icon: const Icon(Icons.close),
                            onPressed: () {
                              _controller.clear();
                              setState(() {
                                _didSearch = false;
                                _hits = const [];
                              });
                            },
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                if (!_didSearch)
                  const Text(
                    'Type a word, then tap Search on the keyboard.',
                    style: TextStyle(color: AuthTheme.mutedBrown),
                  )
                else if (_controller.text.trim().length < 2)
                  const Text('Type at least 2 letters.', style: TextStyle(color: AuthTheme.mutedBrown))
                else if (_hits.isEmpty)
                  const Text('No matches in this chapter.', style: TextStyle(color: AuthTheme.mutedBrown))
                else
                  Text(
                    _hits.length == 1 ? '1 suggestion' : '${_hits.length} suggestions',
                    style: const TextStyle(color: AuthTheme.mutedBrown, fontWeight: FontWeight.w600),
                  ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
          sliver: SliverList.builder(
            itemCount: _hits.length,
            itemBuilder: (context, i) {
              final hit = _hits[i];
              return ListTile(
                title: Text(hit.snippet, maxLines: 3, overflow: TextOverflow.ellipsis),
                trailing: Text('p.${hit.page}', style: const TextStyle(color: AuthTheme.mutedBrown)),
                onTap: () => widget.onOpenPage(hit, _controller.text.trim()),
              );
            },
          ),
        ),
      ],
    );
  }
}

double measureCourseBlock(
  CourseHtmlBlock block,
  double width, {
  required TextScaler textScaler,
  bool firstOnPage = false,
  Set<String> openExplains = const <String>{},
}) {
  final insets = courseHtmlBlockInsets(block.kind, firstOnPage: firstOnPage);
  if (block.kind == CourseHtmlKind.split) {
    final half = ((width - 12) / 2).clamp(40, width).toDouble();
    final tp = TextPainter(
      text: TextSpan(text: block.text, style: courseHtmlStyle(CourseHtmlKind.split)),
      textDirection: TextDirection.ltr,
      textScaler: textScaler,
    )..layout(maxWidth: half);
    final captionH = (block.caption ?? '').trim().isEmpty ? 0 : 18;
    return math.max(tp.height, 128) + captionH + insets.vertical;
  }
  if (block.kind == CourseHtmlKind.image) {
    final captionH = (block.caption ?? block.text).trim().isEmpty ? 0 : 22;
    return 228 + captionH + insets.vertical;
  }
  if (block.kind == CourseHtmlKind.flashcard) {
    return 96 + insets.vertical;
  }
  if (block.kind == CourseHtmlKind.quickCheck) {
    final options = (block.caption ?? '').split('\u001e').where((item) => item.isNotEmpty).length;
    return 72 + options * 36 + insets.vertical;
  }
  if (block.kind == CourseHtmlKind.explain) {
    final id = block.id ?? block.text;
    final open = openExplains.contains(id) || !block.showHeader;
    var height = block.showHeader ? 42.0 : 0.0;
    if (open) {
      final tp = TextPainter(
        text: TextSpan(text: block.text, style: courseHtmlStyle(CourseHtmlKind.explain)),
        textDirection: TextDirection.ltr,
        textScaler: textScaler,
      )..layout(maxWidth: (width - 24).clamp(40, width).toDouble());
      height += tp.height + (block.showHeader ? 12 : 20);
    }
    return height + insets.vertical;
  }
  final style = courseHtmlStyle(block.kind);
  final maxWidth =
      block.kind == CourseHtmlKind.li ? (width - 22).clamp(40, width).toDouble() : width;
  final tp = TextPainter(
    text: TextSpan(text: block.text, style: style),
    textDirection: TextDirection.ltr,
    textScaler: textScaler,
  )..layout(maxWidth: maxWidth);
  var extra = insets.vertical;
  if (block.kind == CourseHtmlKind.callout) extra += 20;
  if (block.kind == CourseHtmlKind.toc) extra += 36;
  if (block.kind == CourseHtmlKind.formula) extra += 16;
  if (block.kind == CourseHtmlKind.table) {
    final rows = block.text.split('\n').where((line) => line.trim().isNotEmpty).length;
    return rows * 28.0 + extra + 12;
  }
  return tp.height + extra;
}

bool _isHeading(CourseHtmlKind kind) =>
    kind == CourseHtmlKind.h1 || kind == CourseHtmlKind.h2 || kind == CourseHtmlKind.h3;

List<CourseHtmlBlock> _splitToFit(
  CourseHtmlBlock block,
  double width,
  double firstMaxHeight,
  double pageMaxHeight, {
  required TextScaler textScaler,
  required bool firstOnPage,
  Set<String> openExplains = const <String>{},
}) {
  final openExplain = block.kind == CourseHtmlKind.explain &&
      (openExplains.contains(block.id ?? block.text) || !block.showHeader);
  if (block.kind == CourseHtmlKind.image ||
      block.kind == CourseHtmlKind.split ||
      block.kind == CourseHtmlKind.flashcard ||
      block.kind == CourseHtmlKind.quickCheck ||
      _isHeading(block.kind) ||
      block.kind == CourseHtmlKind.callout ||
      block.kind == CourseHtmlKind.toc ||
      block.kind == CourseHtmlKind.formula ||
      block.kind == CourseHtmlKind.table ||
      (block.kind == CourseHtmlKind.explain && !openExplain)) {
    return [block];
  }
  if (measureCourseBlock(
        block,
        width,
        textScaler: textScaler,
        firstOnPage: firstOnPage,
        openExplains: openExplains,
      ) <=
      firstMaxHeight) {
    return [block];
  }
  final words = block.text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return [block];
  final parts = <CourseHtmlBlock>[];
  var acc = '';
  var partFirst = firstOnPage;
  var limit = firstMaxHeight;
  var header = block.showHeader;
  for (final word in words) {
    final next = acc.isEmpty ? word : '$acc $word';
    final probe = block.withText(next, showHeader: header);
    if (measureCourseBlock(
          probe,
          width,
          textScaler: textScaler,
          firstOnPage: partFirst,
          openExplains: openExplains,
        ) <=
        limit) {
      acc = next;
      continue;
    }
    if (acc.isNotEmpty) {
      parts.add(block.withText(acc, showHeader: header));
      header = false;
    }
    acc = word;
    partFirst = true;
    limit = pageMaxHeight;
    if (measureCourseBlock(
          block.withText(acc, showHeader: header),
          width,
          textScaler: textScaler,
          firstOnPage: true,
          openExplains: openExplains,
        ) >
        limit) {
      parts.add(block.withText(acc, showHeader: header));
      header = false;
      acc = '';
    }
  }
  if (acc.isNotEmpty) parts.add(block.withText(acc, showHeader: header));
  return parts.isEmpty ? [block] : parts;
}

List<List<CourseHtmlBlock>> paginateCourseBlocks(
  List<CourseHtmlBlock> blocks,
  double width,
  double maxHeight, {
  TextScaler textScaler = TextScaler.noScaling,
  Set<String> openExplains = const <String>{},
}) {
  final budget = (maxHeight - 10).clamp(60, maxHeight).toDouble();
  if (budget < 40 || width < 40) return [blocks];

  final pages = <List<CourseHtmlBlock>>[];
  var current = <CourseHtmlBlock>[];
  var used = 0.0;

  void flush() {
    if (current.isEmpty) return;
    pages.add(current);
    current = <CourseHtmlBlock>[];
    used = 0;
  }

  double heightOf(CourseHtmlBlock block, {required bool first}) {
    return measureCourseBlock(
      block,
      width,
      textScaler: textScaler,
      firstOnPage: first,
      openExplains: openExplains,
    );
  }

  for (var i = 0; i < blocks.length; i++) {
    final block = blocks[i];
    if (_isHeading(block.kind) && current.isNotEmpty) {
      final headingH = heightOf(block, first: false);
      final follow = i + 1 < blocks.length
          ? math.min(72, heightOf(blocks[i + 1], first: false))
          : 0.0;
      if (used + headingH + follow > budget) flush();
    }

    var first = current.isEmpty;
    var room = first ? budget : budget - used;
    const minUseful = 72.0;
    if (!first && room < minUseful) {
      flush();
      first = true;
      room = budget;
    }

    final pieces = _splitToFit(
      block,
      width,
      room,
      budget,
      textScaler: textScaler,
      firstOnPage: first,
      openExplains: openExplains,
    );
    for (final piece in pieces) {
      final pageFirst = current.isEmpty;
      final h = heightOf(piece, first: pageFirst);
      if (current.isNotEmpty && used + h > budget) flush();
      current.add(piece);
      used += heightOf(piece, first: current.length == 1);
    }
  }
  flush();
  return pages;
}
