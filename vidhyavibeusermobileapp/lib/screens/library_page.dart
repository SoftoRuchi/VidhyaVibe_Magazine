import 'package:flutter/material.dart';

import '../config/apiConfig.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/viewing_context.dart';
import '../widgets/auth_widgets.dart';
import 'magazine_detail_page.dart';
import 'reader_page.dart';
import 'subscribe_page.dart';

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key});

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  bool _loading = true;
  String? _error;
  List<LibraryItem> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      int? readerId;
      if (await ViewingContext.isChildAudience()) {
        readerId = await ViewingContext.getSelectedReaderId();
      }
      final res = await ApiClient.getLibrary(readerId: readerId);
      if (!ApiClient.isOk(res)) {
        final data = ApiClient.decodeMap(res);
        throw Exception(
          data['message']?.toString() ??
              data['error']?.toString() ??
              'Failed to load library',
        );
      }
      final data = ApiClient.decodeMap(res);
      final raw = data['items'] is List
          ? data['items'] as List
          : [
              ...(data['subscribed'] is List ? data['subscribed'] as List : []),
              ...(data['purchased'] is List ? data['purchased'] as List : []),
            ];
      final items = raw
          .whereType<Map>()
          .map((e) => LibraryItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      if (!mounted) return;
      setState(() {
        _items = items;
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

  void _openItem(LibraryItem item) {
    if (item.editionId != null) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ReaderPage(
            editionId: item.editionId!,
            title: item.title,
          ),
        ),
      );
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => MagazineDetailPage(magazineId: item.magazineId),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar('My Library', automaticallyImplyLeading: false),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? ListView(
                            children: [
                              const SizedBox(height: 80),
                              const Icon(
                                Icons.menu_book_outlined,
                                size: 56,
                                color: AuthTheme.mutedBrown,
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'No magazines yet',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AuthTheme.brown,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Subscribe to start reading.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: AuthTheme.mutedBrown),
                              ),
                              const SizedBox(height: 20),
                              Center(
                                child: ElevatedButton(
                                  onPressed: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => const SubscribePage(),
                                      ),
                                    );
                                  },
                                  style: AuthTheme.primaryButtonStyle,
                                  child: const Text('Subscribe'),
                                ),
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                            itemCount: _items.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final item = _items[index];
                              final cover = ApiConfig.absoluteUrl(item.coverKey);
                              return Material(
                                color: Colors.white.withValues(alpha: 0.85),
                                borderRadius: BorderRadius.circular(14),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(12),
                                  leading: ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: cover.isEmpty
                                        ? Container(
                                            width: 52,
                                            height: 68,
                                            color: AuthTheme.green
                                                .withValues(alpha: 0.12),
                                            child: const Icon(
                                              Icons.menu_book,
                                              color: AuthTheme.green,
                                            ),
                                          )
                                        : Image.network(
                                            cover,
                                            width: 52,
                                            height: 68,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) =>
                                                Container(
                                              width: 52,
                                              height: 68,
                                              color: AuthTheme.green
                                                  .withValues(alpha: 0.12),
                                              child: const Icon(
                                                Icons.menu_book,
                                                color: AuthTheme.green,
                                              ),
                                            ),
                                          ),
                                  ),
                                  title: Text(
                                    item.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AuthTheme.brown,
                                    ),
                                  ),
                                  subtitle: Text(item.subtitle),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () => _openItem(item),
                                ),
                              );
                            },
                          ),
                  ),
      ),
    );
  }
}
