import 'package:flutter/material.dart';

import '../models/course_models.dart';
import '../models/course_study.dart';
import '../services/course_study_service.dart';
import '../services/courses_service.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/course_book_pager.dart';
import '../widgets/course_html_view.dart';
import '../widgets/course_quick_check.dart';
import 'course_notes_page.dart';
import 'course_quiz_page.dart';

class CourseReaderPage extends StatefulWidget {
  const CourseReaderPage({
    super.key,
    required this.subjectId,
    required this.chapterId,
    required this.chapters,
    this.initialPage,
  });

  final int subjectId;
  final int chapterId;
  final List<CourseChapterSummary> chapters;
  final int? initialPage;

  @override
  State<CourseReaderPage> createState() => _CourseReaderPageState();
}

class _CourseReaderPageState extends State<CourseReaderPage> {
  final _pagerKey = GlobalKey<CourseBookPagerState>();
  late int _chapterId;
  bool _loading = true;
  String? _error;
  CourseChapterDetail? _chapter;
  CourseStudyData _study = CourseStudyData(
    bookmarks: const [],
    notes: const [],
    highlights: const [],
  );
  List<CourseFlashcard> _flashcards = const [];
  int _printedPage = 1;
  int? _resumePage;

  @override
  void initState() {
    super.initState();
    _chapterId = widget.chapterId;
    _resumePage = widget.initialPage;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final chapter = await CoursesService.getChapter(_chapterId);
      final study = await CourseStudyService.load(_chapterId);
      final cards = await CourseStudyService.loadFlashcards(_chapterId);
      if (!mounted) return;
      setState(() {
        _chapter = chapter;
        _study = study;
        _flashcards = cards;
        _printedPage = chapter.startPage ?? 1;
        _loading = false;
      });
      final resume = _resumePage;
      _resumePage = null;
      if (resume != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _pagerKey.currentState?.goToPrintedPage(resume);
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _refreshStudy() async {
    final study = await CourseStudyService.load(_chapterId);
    final cards = await CourseStudyService.loadFlashcards(_chapterId);
    if (!mounted) return;
    setState(() {
      _study = study;
      _flashcards = cards;
    });
  }

  Future<void> _makeFlashcard(String front) async {
    final frontCtrl = TextEditingController(text: front.trim());
    final backCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('New flashcard'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: frontCtrl,
                decoration: const InputDecoration(labelText: 'Term'),
              ),
              TextField(
                controller: backCtrl,
                autofocus: true,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Meaning'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        );
      },
    );
    final term = frontCtrl.text.trim();
    final meaning = backCtrl.text.trim();
    frontCtrl.dispose();
    backCtrl.dispose();
    if (ok != true || term.isEmpty || meaning.isEmpty) return;
    final saved = await CourseStudyService.addFlashcard(
      chapterId: _chapterId,
      front: term,
      back: meaning,
      pageNumber: _printedPage,
    );
    if (saved == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save flashcard. Please login and try again.')),
      );
      return;
    }
    await _refreshStudy();
  }

  void _openChapter(int id) {
    if (id == _chapterId) return;
    setState(() => _chapterId = id);
    _load();
  }

  Future<void> _savePage(int printedPage, int pageIndex, int pageCount) async {
    _printedPage = printedPage;
    final percent = pageCount <= 0 ? 0 : (((pageIndex + 1) / pageCount) * 100).round();
    try {
      await CoursesService.saveProgress(
        subjectId: widget.subjectId,
        chapterId: _chapterId,
        percent: percent,
        currentPage: printedPage,
      );
    } catch (_) {}
  }

  CourseBookmark? _bookmarkOn(int page) {
    for (final b in _study.bookmarks) {
      if (b.pageNumber == page) return b;
    }
    return null;
  }

  Future<void> _setBookmark(int page, String markType) async {
    final saved = await CourseStudyService.addBookmark(
      chapterId: _chapterId,
      pageNumber: page,
      markType: markType,
    );
    if (!mounted) return;
    if (saved == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update bookmark. Please login and try again.')),
      );
      return;
    }
    await _refreshStudy();
  }

  Future<void> _removeBookmark(int page) async {
    final existing = _bookmarkOn(page);
    if (existing == null) return;
    final ok = await CourseStudyService.removeBookmark(existing.id);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update bookmark. Please login and try again.')),
      );
      return;
    }
    await _refreshStudy();
  }

  Future<void> _saveHighlight(String text, String color) async {
    final phrase = text.trim();
    if (phrase.length < 2) return;
    for (final existing in _study.highlights.where((h) => highlightSame(h.text, phrase))) {
      await CourseStudyService.deleteHighlight(existing.id);
    }
    final saved = await CourseStudyService.addHighlight(
      chapterId: _chapterId,
      text: phrase,
      pageNumber: _printedPage,
      color: color,
    );
    if (!mounted) return;
    if (saved == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save highlight. Please login and try again.')),
      );
      return;
    }
    await _refreshStudy();
  }

  Future<void> _removeHighlights(String text) async {
    final phrase = text.trim();
    final matches = _study.highlights.where((h) => highlightOverlaps(h.text, phrase)).toList();
    if (matches.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select highlighted text to remove it.')),
      );
      return;
    }
    for (final item in matches) {
      await CourseStudyService.deleteHighlight(item.id);
    }
    await _refreshStudy();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Highlight removed'), duration: Duration(seconds: 1)),
    );
  }

  void _openChapters() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text('Chapters', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            for (final c in widget.chapters)
              ListTile(
                title: Text(
                  c.title,
                  style: TextStyle(
                    fontWeight: c.id == _chapterId ? FontWeight.w800 : FontWeight.w500,
                  ),
                ),
                selected: c.id == _chapterId,
                onTap: () {
                  Navigator.pop(ctx);
                  _openChapter(c.id);
                },
              ),
          ],
        );
      },
    );
  }

  Future<void> _openNotes({String quote = ''}) async {
    final jump = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => CourseNotesPage(
          chapterId: _chapterId,
          chapterTitle: _chapter?.title ?? 'Notes',
          currentPage: _printedPage,
          initialQuote: quote,
        ),
      ),
    );
    await _refreshStudy();
    if (!mounted) return;
    final page = jump == null ? null : int.tryParse('${jump['page']}');
    final jumpedQuote = jump?['quote']?.toString().trim() ?? '';
    if (page != null) {
      _pagerKey.currentState?.goToPrintedPage(page);
      if (jumpedQuote.length >= 2) {
        _pagerKey.currentState?.flashQuote(jumpedQuote);
      }
    }
  }

  Future<void> _openHighlights() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheet) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Text('Highlights', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                if (_study.highlights.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Select text in the book, then choose a color.'),
                  ),
                for (final item in _study.highlights)
                  ListTile(
                    leading: Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        color: parseHighlightColor(item.color).withValues(alpha: 1),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    title: Text(item.text, maxLines: 3, overflow: TextOverflow.ellipsis),
                    subtitle: item.pageNumber == null ? null : Text('Page ${item.pageNumber}'),
                    trailing: IconButton(
                      tooltip: 'Remove',
                      icon: const Icon(Icons.close),
                      onPressed: () async {
                        await CourseStudyService.deleteHighlight(item.id);
                        await _refreshStudy();
                        setSheet(() {});
                      },
                    ),
                    onTap: item.pageNumber == null
                        ? null
                        : () {
                            Navigator.pop(ctx);
                            _pagerKey.currentState?.goToPrintedPage(item.pageNumber!);
                          },
                  ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final chapter = _chapter;
    final checks = chapter == null ? const <CourseQuickCheckItem>[] : quickChecksFromActivities(chapter.activities);

    return Scaffold(
      appBar: AuthTheme.buildAppBar(
        chapter?.title ?? 'Read',
        actions: [
          if (chapter != null)
            TextButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CourseQuizPage(chapterId: chapter.id),
                  ),
                );
              },
              child: const Text('Practice'),
            ),
        ],
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : chapter == null
                    ? const SizedBox.shrink()
                    : CourseBookPager(
                        key: _pagerKey,
                        html: chapter.content,
                        runningHeader: chapter.courseName,
                        chapterTitle: chapter.title,
                        startPage: chapter.startPage ?? 1,
                        highlights: [
                          for (final h in _study.highlights)
                            CourseHighlightMark(text: h.text, color: h.color, pageNumber: h.pageNumber),
                        ],
                        bookmarkTypes: {
                          for (final b in _study.bookmarks) b.pageNumber: b.markType,
                        },
                        onHighlight: _saveHighlight,
                        onRemoveHighlight: _removeHighlights,
                        onNote: (quote) => _openNotes(quote: quote),
                        onAddFlashcard: _makeFlashcard,
                        onDeleteFlashcard: (card) async {
                          await CourseStudyService.deleteFlashcard(card.id);
                          await _refreshStudy();
                        },
                        onSetBookmark: _setBookmark,
                        onRemoveBookmark: _removeBookmark,
                        onOpenHighlights: _openHighlights,
                        onOpenNotes: () => _openNotes(),
                        onOpenPractice: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => CourseQuizPage(chapterId: chapter.id),
                            ),
                          );
                        },
                        onOpenChapters: widget.chapters.length > 1 ? _openChapters : null,
                        quickChecks: checks,
                        flashcards: _flashcards,
                        onPageChanged: (index, count, printed) {
                          _printedPage = printed;
                          _savePage(printed, index, count);
                        },
                      ),
      ),
    );
  }
}
