import 'package:flutter/material.dart';

import '../config/apiConfig.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/viewing_context.dart';
import '../widgets/auth_widgets.dart';
import 'reader_page.dart';
import 'subscribe_page.dart';

class MagazineDetailPage extends StatefulWidget {
  const MagazineDetailPage({super.key, required this.magazineId});

  final int magazineId;

  @override
  State<MagazineDetailPage> createState() => _MagazineDetailPageState();
}

class _MagazineDetailPageState extends State<MagazineDetailPage> {
  bool _loading = true;
  String? _error;
  MagazineSummary? _magazine;
  List<EditionSummary> _editions = [];
  bool _subscribed = false;
  int? _subscribedEditionId;
  bool _isChild = false;

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
      final isChild = await ViewingContext.isChildAudience();
      final magRes = await ApiClient.getMagazine(widget.magazineId);
      final edRes = await ApiClient.listEditions(widget.magazineId);
      var subscribed = false;
      int? subEditionId;
      try {
        final check = await ApiClient.checkSubscription(widget.magazineId);
        if (ApiClient.isOk(check)) {
          final data = ApiClient.decodeMap(check);
          subscribed = data['subscribed'] == true;
          subEditionId = data['editionId'] is int
              ? data['editionId'] as int
              : int.tryParse('${data['editionId']}');
        }
      } catch (_) {}

      if (!ApiClient.isOk(magRes)) {
        throw Exception('Magazine not found');
      }
      final mag = MagazineSummary.fromJson(ApiClient.decodeMap(magRes));
      final editions = ApiClient.isOk(edRes)
          ? ApiClient.decodeList(edRes)
              .whereType<Map>()
              .map((e) => EditionSummary.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <EditionSummary>[];

      if (!mounted) return;
      setState(() {
        _isChild = isChild;
        _magazine = mag;
        _editions = editions;
        _subscribed = subscribed;
        _subscribedEditionId = subEditionId;
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

  void _readEdition(EditionSummary edition, {required bool sample}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReaderPage(
          editionId: edition.id,
          title: _magazine?.title ?? edition.label,
          sample: sample,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar(_magazine?.title ?? 'Magazine'),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _buildHeader(),
                        const SizedBox(height: 16),
                        if (!_isChild)
                          AuthPrimaryButton(
                            label: _subscribed ? 'Manage / renew' : 'Subscribe',
                            loading: false,
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => SubscribePage(
                                    initialMagazineId: widget.magazineId,
                                  ),
                                ),
                              );
                            },
                          ),
                        if (_subscribed && _subscribedEditionId != null) ...[
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ReaderPage(
                                    editionId: _subscribedEditionId!,
                                    title: _magazine?.title ?? 'Magazine',
                                  ),
                                ),
                              );
                            },
                            icon: const Icon(Icons.menu_book),
                            label: const Text('Continue reading'),
                          ),
                        ],
                        const SizedBox(height: 24),
                        const Text(
                          'Editions',
                          style: TextStyle(
                            fontFamily: 'serif',
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AuthTheme.brown,
                          ),
                        ),
                        const SizedBox(height: 10),
                        if (_editions.isEmpty)
                          const Text(
                            'No published editions yet.',
                            style: TextStyle(color: AuthTheme.mutedBrown),
                          )
                        else
                          ..._editions.map(_buildEditionTile),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildHeader() {
    final cover = ApiConfig.absoluteUrl(_magazine?.coverUrl);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: cover.isEmpty
              ? Container(
                  width: 110,
                  height: 140,
                  color: AuthTheme.green.withValues(alpha: 0.12),
                  child: const Icon(Icons.menu_book, color: AuthTheme.green, size: 40),
                )
              : Image.network(
                  cover,
                  width: 110,
                  height: 140,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 110,
                    height: 140,
                    color: AuthTheme.green.withValues(alpha: 0.12),
                    child: const Icon(Icons.menu_book, color: AuthTheme.green, size: 40),
                  ),
                ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _magazine?.title ?? '',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AuthTheme.brown,
                ),
              ),
              if (_magazine?.category != null) ...[
                const SizedBox(height: 6),
                Text(
                  _magazine!.category!,
                  style: const TextStyle(color: AuthTheme.mutedBrown),
                ),
              ],
              if (_magazine?.description != null) ...[
                const SizedBox(height: 8),
                Text(
                  _magazine!.description!,
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AuthTheme.mutedBrown, fontSize: 13),
                ),
              ],
              const SizedBox(height: 8),
              Text(
                _subscribed ? 'You have access' : 'Subscribe to read full editions',
                style: TextStyle(
                  color: _subscribed ? AuthTheme.green : AuthTheme.mutedBrown,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEditionTile(EditionSummary edition) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              edition.label,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AuthTheme.brown,
              ),
            ),
            if (edition.pages != null)
              Text(
                '${edition.pages} pages',
                style: const TextStyle(color: AuthTheme.mutedBrown, fontSize: 12),
              ),
            const SizedBox(height: 10),
            Row(
              children: [
                if (edition.hasSample || _magazine?.sampleEditionId == edition.id)
                  TextButton(
                    onPressed: () => _readEdition(edition, sample: true),
                    child: const Text('Sample'),
                  ),
                const Spacer(),
                ElevatedButton(
                  onPressed: () {
                    if (_subscribed) {
                      _readEdition(edition, sample: false);
                    } else if (_isChild) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Ask a parent to subscribe, or open a sample.',
                          ),
                        ),
                      );
                    } else {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => SubscribePage(
                            initialMagazineId: widget.magazineId,
                          ),
                        ),
                      );
                    }
                  },
                  style: AuthTheme.primaryButtonStyle,
                  child: Text(_subscribed ? 'Read' : 'Subscribe to read'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
