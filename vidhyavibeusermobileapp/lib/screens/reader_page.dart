import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:path_provider/path_provider.dart';

import '../services/api_client.dart';
import '../widgets/auth_widgets.dart';

class ReaderPage extends StatefulWidget {
  const ReaderPage({
    super.key,
    required this.editionId,
    required this.title,
    this.sample = false,
  });

  final int editionId;
  final String title;
  final bool sample;

  @override
  State<ReaderPage> createState() => _ReaderPageState();
}

class _ReaderPageState extends State<ReaderPage> {
  String? _localPath;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadPdf();
  }

  Future<void> _loadPdf() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Prefer metadata → pdfUrl when available; otherwise hit pdf endpoints directly.
      final pagesRes = await ApiClient.editionPages(
        widget.editionId,
        sample: widget.sample,
      );
      if (!ApiClient.isOk(pagesRes)) {
        final data = ApiClient.decodeMap(pagesRes);
        throw Exception(
          data['message']?.toString() ??
              data['error']?.toString() ??
              'Unable to open this edition',
        );
      }

      final pdfRes = await ApiClient.downloadEditionPdf(
        widget.editionId,
        sample: widget.sample,
      );
      if (!ApiClient.isOk(pdfRes) || pdfRes.bodyBytes.isEmpty) {
        final data = ApiClient.decodeMap(pdfRes);
        throw Exception(
          data['message']?.toString() ??
              data['error']?.toString() ??
              'PDF not available',
        );
      }

      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/edition_${widget.editionId}_${widget.sample ? 'sample' : 'full'}.pdf',
      );
      await file.writeAsBytes(pdfRes.bodyBytes, flush: true);
      if (!mounted) return;
      setState(() {
        _localPath = file.path;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar(
        widget.sample ? '${widget.title} (Sample)' : widget.title,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AuthTheme.mutedBrown),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadPdf,
                          style: AuthTheme.primaryButtonStyle,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : PDFView(
                  filePath: _localPath!,
                  enableSwipe: true,
                  swipeHorizontal: false,
                  autoSpacing: true,
                  pageFling: true,
                ),
    );
  }
}
