import 'package:flutter/material.dart';

import '../models/course_study.dart';
import '../services/course_study_service.dart';
import '../widgets/auth_widgets.dart';

class CourseNotesPage extends StatefulWidget {
  const CourseNotesPage({
    super.key,
    required this.chapterId,
    required this.chapterTitle,
    required this.currentPage,
    this.initialQuote = '',
  });

  final int chapterId;
  final String chapterTitle;
  final int currentPage;
  final String initialQuote;

  @override
  State<CourseNotesPage> createState() => _CourseNotesPageState();
}

class _CourseNotesPageState extends State<CourseNotesPage> {
  final _composer = TextEditingController();
  List<CourseNoteItem> _notes = const [];
  bool _loading = true;
  String? _error;
  bool _saving = false;
  String _quote = '';

  @override
  void initState() {
    super.initState();
    _quote = widget.initialQuote.trim();
    _load();
  }

  @override
  void dispose() {
    _composer.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final study = await CourseStudyService.load(widget.chapterId);
      if (!mounted) return;
      setState(() {
        _notes = study.notes;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _add() async {
    final content = _composer.text.trim();
    if (content.isEmpty || _saving) return;
    setState(() => _saving = true);
    final saved = await CourseStudyService.addNote(
      chapterId: widget.chapterId,
      content: content,
      pageNumber: widget.currentPage,
      quote: _quote,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (saved == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save the note. Please try again.')),
      );
      return;
    }
    _composer.clear();
    setState(() => _quote = '');
    await _load();
  }

  Future<void> _edit(CourseNoteItem note) async {
    final controller = TextEditingController(text: note.content);
    final next = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Edit note'),
          content: TextField(
            controller: controller,
            maxLines: 8,
            autofocus: true,
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              style: FilledButton.styleFrom(backgroundColor: AuthTheme.green),
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
    controller.dispose();
    if (next == null || next.isEmpty || next == note.content) return;
    final ok = await CourseStudyService.updateNote(note.id, next);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update the note.')),
      );
      return;
    }
    await _load();
  }

  Future<void> _delete(CourseNoteItem note) async {
    final ok = await CourseStudyService.deleteNote(note.id);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not delete the note.')),
      );
      return;
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar('Notes'),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            widget.chapterTitle,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AuthTheme.brown,
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: _notes.isEmpty
                            ? const Center(
                                child: Text(
                                  'No notes yet.\nWrite one below for this page.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: AuthTheme.mutedBrown, height: 1.5),
                                ),
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                itemCount: _notes.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (context, i) {
                                  final note = _notes[i];
                                  return Material(
                                    color: const Color(0xFFFFF6C8),
                                    borderRadius: BorderRadius.circular(12),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(12),
                                      onTap: () => _edit(note),
                                      child: Padding(
                                        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
                                        child: Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  if (note.pageNumber != null)
                                                    TextButton(
                                                      style: TextButton.styleFrom(
                                                        padding: EdgeInsets.zero,
                                                        minimumSize: Size.zero,
                                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                        foregroundColor: AuthTheme.green,
                                                      ),
                                                      onPressed: () => Navigator.pop(context, {
                                                        'page': note.pageNumber,
                                                        if (note.quote != null) 'quote': note.quote,
                                                      }),
                                                      child: Text('Page ${note.pageNumber}'),
                                                    ),
                                                  if (note.quote != null && note.quote!.isNotEmpty) ...[
                                                    const SizedBox(height: 6),
                                                    Text(
                                                      '“${note.quote}”',
                                                      style: const TextStyle(
                                                        fontStyle: FontStyle.italic,
                                                        height: 1.35,
                                                        color: AuthTheme.mutedBrown,
                                                      ),
                                                    ),
                                                  ],
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    note.content,
                                                    style: const TextStyle(
                                                      height: 1.45,
                                                      color: AuthTheme.brown,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            IconButton(
                                              tooltip: 'Delete',
                                              onPressed: () => _delete(note),
                                              icon: const Icon(Icons.close, size: 20),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                      SafeArea(
                        top: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Note for page ${widget.currentPage}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AuthTheme.mutedBrown,
                                ),
                              ),
                              if (_quote.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEAF4E4),
                                    borderRadius: BorderRadius.circular(8),
                                    border: const Border(
                                      left: BorderSide(color: AuthTheme.green, width: 3),
                                    ),
                                  ),
                                  child: Text(
                                    '“$_quote”',
                                    style: const TextStyle(
                                      fontStyle: FontStyle.italic,
                                      height: 1.35,
                                      color: AuthTheme.brown,
                                    ),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              TextField(
                                controller: _composer,
                                maxLines: 4,
                                decoration: const InputDecoration(
                                  hintText: 'Write your note…',
                                  filled: true,
                                  fillColor: Color(0xFFFFFDF6),
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 8),
                              FilledButton(
                                onPressed: _saving ? null : _add,
                                style: FilledButton.styleFrom(backgroundColor: AuthTheme.green),
                                child: Text(_saving ? 'Saving…' : 'Save note'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}
