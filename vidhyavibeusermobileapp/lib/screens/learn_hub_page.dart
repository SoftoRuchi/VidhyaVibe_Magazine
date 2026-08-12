import 'package:flutter/material.dart';

import '../widgets/auth_widgets.dart';
import 'learn_catalog_page.dart';

/// Learn hub: admin-configured activities catalog.
class LearnHubPage extends StatelessWidget {
  const LearnHubPage({
    super.key,
    this.initialSubject,
    this.autoGenerate = false,
    this.initialTab = 0,
  });

  /// Kept for call-site compatibility; unused after AI Packs removal.
  final String? initialSubject;
  final bool autoGenerate;
  final int initialTab;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Learn'),
        backgroundColor: AuthTheme.appBar,
        foregroundColor: AuthTheme.brown,
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: const LearnCatalogPage(),
      ),
    );
  }
}
