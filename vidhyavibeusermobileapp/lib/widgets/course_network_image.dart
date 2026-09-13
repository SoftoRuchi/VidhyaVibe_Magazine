import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../config/apiConfig.dart';
import '../services/api_client.dart';

final Map<String, Uint8List> _imageCache = {};
final Map<String, double> _aspectCache = {};

class CourseNetworkImage extends StatefulWidget {
  const CourseNetworkImage({
    super.key,
    required this.src,
    this.height = 180,
    this.fallbackText = '',
  });

  final String src;
  final double height;
  final String fallbackText;

  @override
  State<CourseNetworkImage> createState() => _CourseNetworkImageState();
}

class _CourseNetworkImageState extends State<CourseNetworkImage> {
  Uint8List? _bytes;
  double? _aspect;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _hydrateFromCache();
    if (_bytes == null) _load();
  }

  void _hydrateFromCache() {
    for (final url in candidateImageUrls(widget.src)) {
      final cached = _imageCache[url];
      if (cached != null && cached.isNotEmpty) {
        _bytes = cached;
        _aspect = _aspectCache[url];
        return;
      }
    }
  }

  @override
  void didUpdateWidget(covariant CourseNetworkImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.src != widget.src) _load();
  }

  Future<double?> _readAspect(Uint8List bytes) async {
    try {
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      final image = frame.image;
      final aspect = image.width / image.height;
      image.dispose();
      return aspect;
    } catch (_) {
      return null;
    }
  }

  Future<void> _accept(String url, Uint8List bytes) async {
    final aspect = _aspectCache[url] ?? await _readAspect(bytes);
    if (aspect != null) _aspectCache[url] = aspect;
    _imageCache[url] = bytes;
    if (!mounted) return;
    setState(() {
      _bytes = bytes;
      _aspect = aspect;
      _failed = false;
    });
  }

  Future<void> _load() async {
    final urls = candidateImageUrls(widget.src);
    if (urls.isEmpty) {
      if (mounted) setState(() => _failed = true);
      return;
    }

    for (final url in urls) {
      final cached = _imageCache[url];
      if (cached != null && cached.isNotEmpty) {
        await _accept(url, cached);
        return;
      }
    }

    if (mounted) {
      setState(() {
        _bytes = null;
        _aspect = null;
        _failed = false;
      });
    }

    for (final url in urls) {
      try {
        final res = await ApiClient.getBytes(url, auth: false);
        final ct = (res.headers['content-type'] ?? '').toLowerCase();
        final isJson = ct.contains('json');
        final looksLikeImage = _looksLikeImage(res.bodyBytes) || (ct.startsWith('image/') && !isJson);
        if (res.statusCode >= 200 &&
            res.statusCode < 300 &&
            !isJson &&
            looksLikeImage &&
            res.bodyBytes.isNotEmpty) {
          await _accept(url, res.bodyBytes);
          return;
        }
      } catch (_) {}
    }

    if (mounted) setState(() => _failed = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return SizedBox(height: widget.height);
    }
    if (_bytes == null) {
      return SizedBox(
        height: widget.height,
        child: const Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth.isFinite && constraints.maxWidth > 0
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        final maxH = widget.height;
        var width = maxW;
        var height = maxH;
        final aspect = _aspect;
        if (aspect != null && aspect > 0) {
          height = width / aspect;
          if (height > maxH) {
            height = maxH;
            width = height * aspect;
          }
        }
        return Align(
          alignment: Alignment.topCenter,
          child: Image.memory(
            _bytes!,
            width: width,
            height: height,
            fit: BoxFit.contain,
            alignment: Alignment.center,
            filterQuality: FilterQuality.medium,
            gaplessPlayback: true,
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}

bool _looksLikeImage(Uint8List bytes) {
  if (bytes.length < 12) return false;
  if (bytes[0] == 0xFF && bytes[1] == 0xD8) return true;
  if (bytes[0] == 0x89 && bytes[1] == 0x50) return true;
  if (bytes[0] == 0x47 && bytes[1] == 0x49) return true;
  if (bytes[0] == 0x52 && bytes[8] == 0x57) return true;
  return false;
}

String unescapeHtmlSrc(String value) {
  return value
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .trim();
}

List<String> candidateImageUrls(String? raw) {
  var src = unescapeHtmlSrc(raw ?? '');
  if (src.isEmpty) return const [];
  if (src.startsWith('//')) src = 'https:$src';

  final urls = <String>[];
  void add(String value) {
    if (value.isNotEmpty && !urls.contains(value)) urls.add(value);
  }

  final absolute = _toAbsolute(src);
  add(absolute);
  final file = _fileStyleUrl(absolute);
  if (file != null) add(file);
  final serve = _serveStyleUrl(absolute);
  if (serve != null) add(serve);

  return urls;
}

String _toAbsolute(String src) {
  final parsed = Uri.tryParse(src);
  if (parsed != null &&
      parsed.hasScheme &&
      (parsed.scheme == 'http' || parsed.scheme == 'https')) {
    if (parsed.host == 'localhost' || parsed.host == '127.0.0.1') {
      return ApiConfig.absoluteUrl(
        '${parsed.path}${parsed.hasQuery ? '?${parsed.query}' : ''}',
      );
    }
    return src;
  }
  return ApiConfig.absoluteUrl(src);
}

String? _fileStyleUrl(String absolute) {
  final uri = Uri.tryParse(absolute);
  if (uri == null) return null;
  final path = uri.path;
  if (path.endsWith('/assets/serve') || path.endsWith('/api/assets/serve')) {
    final key = uri.queryParameters['key'] ?? '';
    if (key.isEmpty) return null;
    final encoded = key.split('/').where((p) => p.isNotEmpty).map(Uri.encodeComponent).join('/');
    return '${ApiConfig.baseUrl}/api/assets/file/$encoded';
  }
  return null;
}

String? _serveStyleUrl(String absolute) {
  final uri = Uri.tryParse(absolute);
  if (uri == null) return null;
  final match = RegExp(r'/api/assets/file/(.+)$').firstMatch(uri.path);
  if (match == null) return null;
  final key = Uri.decodeComponent(match.group(1) ?? '');
  if (key.isEmpty) return null;
  return '${ApiConfig.baseUrl}/api/assets/serve?key=${Uri.encodeQueryComponent(key)}';
}
