import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Renders PDF pages to JPEG via Android PdfRenderer / iOS PDFKit.
class PdfPageRasterizer {
  PdfPageRasterizer();

  static const _channel = MethodChannel('vidhyavibe/pdf_pages');

  int pageCount = 0;
  bool _open = false;
  final Map<int, Uint8List> _cache = {};
  Future<void> _queue = Future.value();
  int _focusPage = 1;
  List<String>? _pageTexts;

  Future<int> open(String path) async {
    await close();
    final count = await _channel.invokeMethod<int>('open', {'path': path});
    pageCount = count ?? 0;
    _open = pageCount > 0;
    _pageTexts = null;
    return pageCount;
  }

  Future<Uint8List?> pageBytes(int pageNumber) {
    if (!_open || pageNumber < 1 || pageNumber > pageCount) {
      return Future.value(null);
    }
    final cached = _cache[pageNumber];
    if (cached != null) return Future.value(cached);

    final done = Completer<Uint8List?>();
    _queue = _queue.then((_) async {
      if (!_open) {
        if (!done.isCompleted) done.complete(null);
        return;
      }
      final again = _cache[pageNumber];
      if (again != null) {
        if (!done.isCompleted) done.complete(again);
        return;
      }
      try {
        final bytes = await _channel.invokeMethod<Uint8List>('renderPage', {
          'page': pageNumber,
          'maxWidth': 1080,
        });
        if (bytes != null) {
          _cache[pageNumber] = bytes;
          _evict();
        }
        if (!done.isCompleted) done.complete(bytes);
      } catch (e, st) {
        if (!done.isCompleted) done.completeError(e, st);
      }
    });
    return done.future;
  }

  /// One string per page (1-based index = list index + 1).
  Future<List<String>> extractText() async {
    if (!_open) return const [];
    final cached = _pageTexts;
    if (cached != null) return cached;
    final raw = await _channel.invokeMethod<List<dynamic>>('extractText');
    final pages = (raw ?? const []).map((e) => e?.toString() ?? '').toList();
    if (pages.length < pageCount) {
      pages.addAll(List<String>.filled(pageCount - pages.length, ''));
    }
    _pageTexts = pages;
    return pages;
  }

  void preloadNearby(int pageNumber) {
    _focusPage = pageNumber;
    for (final p in [pageNumber, pageNumber + 1, pageNumber - 1, pageNumber + 2]) {
      if (p >= 1 && p <= pageCount && !_cache.containsKey(p)) {
        unawaited(pageBytes(p));
      }
    }
  }

  Future<void> close() async {
    _open = false;
    _cache.clear();
    _pageTexts = null;
    pageCount = 0;
    try {
      await _channel.invokeMethod<void>('close');
    } catch (_) {}
  }

  void _evict() {
    const maxCached = 16;
    if (_cache.length <= maxCached) return;
    final keys = _cache.keys.toList()
      ..sort(
        (a, b) => (a - _focusPage).abs().compareTo((b - _focusPage).abs()),
      );
    for (final key in keys.skip(maxCached)) {
      _cache.remove(key);
    }
  }
}
