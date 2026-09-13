import 'package:flutter/material.dart';

import '../models/course_study.dart';
import 'auth_widgets.dart';

class CourseFlashcardDeck extends StatefulWidget {
  const CourseFlashcardDeck({
    super.key,
    required this.cards,
    this.onDelete,
  });

  final List<CourseFlashcard> cards;
  final Future<void> Function(CourseFlashcard card)? onDelete;

  @override
  State<CourseFlashcardDeck> createState() => _CourseFlashcardDeckState();
}

class _CourseFlashcardDeckState extends State<CourseFlashcardDeck> {
  late List<CourseFlashcard> _queue;
  int _index = 0;
  bool _flipped = false;
  int _known = 0;

  @override
  void initState() {
    super.initState();
    _queue = List.of(widget.cards);
  }

  @override
  void didUpdateWidget(covariant CourseFlashcardDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.cards != widget.cards) {
      _queue = List.of(widget.cards);
      _index = 0;
      _flipped = false;
      _known = 0;
    }
  }

  void _go(int next) {
    if (_queue.isEmpty) return;
    setState(() {
      _index = (next + _queue.length) % _queue.length;
      _flipped = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.cards.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Text(
          'No flashcards in this chapter yet. Select a term on the page and tap Flashcard.',
          style: TextStyle(color: AuthTheme.mutedBrown, height: 1.4),
        ),
      );
    }
    if (_queue.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Done', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AuthTheme.brown)),
            const SizedBox(height: 8),
            Text(
              'You marked $_known card${_known == 1 ? '' : 's'} as known.',
              style: const TextStyle(color: AuthTheme.brown, height: 1.4),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => setState(() {
                _queue = List.of(widget.cards);
                _index = 0;
                _flipped = false;
                _known = 0;
              }),
              style: FilledButton.styleFrom(backgroundColor: AuthTheme.green),
              child: const Text('Restart deck'),
            ),
          ],
        ),
      );
    }
    final card = _queue[_index.clamp(0, _queue.length - 1)];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Flashcards · ${_index + 1} of ${_queue.length}${_known > 0 ? ' · $_known known' : ''}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AuthTheme.mutedBrown,
            ),
          ),
          const SizedBox(height: 10),
          Material(
            color: _flipped ? const Color(0xFFFFF6C8) : const Color(0xFFFFFDF6),
            elevation: 2,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => setState(() => _flipped = !_flipped),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 150),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _flipped ? 'ANSWER' : 'TERM',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: AuthTheme.mutedBrown,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _flipped ? card.back : card.front,
                        style: const TextStyle(
                          fontSize: 18,
                          height: 1.4,
                          fontWeight: FontWeight.w700,
                          color: AuthTheme.brown,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text('Tap to flip', style: TextStyle(color: AuthTheme.mutedBrown, fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: _queue.length < 2 ? null : () => _go(_index - 1),
                child: const Text('Previous'),
              ),
              OutlinedButton(
                onPressed: () => setState(() {
                  final rest = [..._queue]..removeAt(_index);
                  _queue = [...rest, card];
                  _index = 0;
                  _flipped = false;
                }),
                child: const Text('Again'),
              ),
              FilledButton(
                onPressed: () => setState(() {
                  _queue = [..._queue]..removeAt(_index);
                  _index = 0;
                  _flipped = false;
                  _known += 1;
                }),
                style: FilledButton.styleFrom(backgroundColor: AuthTheme.green),
                child: const Text('Knew it'),
              ),
              OutlinedButton(
                onPressed: _queue.length < 2 ? null : () => _go(_index + 1),
                child: const Text('Next'),
              ),
            ],
          ),
          if (card.owned && widget.onDelete != null)
            TextButton(
              onPressed: () => widget.onDelete!(card),
              child: const Text('Remove my card'),
            ),
        ],
      ),
    );
  }
}
