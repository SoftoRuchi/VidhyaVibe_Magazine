import 'package:flutter/material.dart';

import '../widgets/auth_widgets.dart';
import 'activities_page.dart';
import 'learn_catalog_page.dart';

/// Learn hub: admin-configured activities + AI packs.
class LearnHubPage extends StatelessWidget {
  const LearnHubPage({
    super.key,
    this.initialSubject,
    this.autoGenerate = false,
    this.initialTab = 0,
  });

  final String? initialSubject;
  final bool autoGenerate;
  final int initialTab;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: autoGenerate ? 1 : initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Learn'),
          backgroundColor: AuthTheme.appBar,
          foregroundColor: AuthTheme.brown,
          elevation: 0,
          automaticallyImplyLeading: false,
          bottom: const TabBar(
            labelColor: AuthTheme.brown,
            unselectedLabelColor: AuthTheme.mutedBrown,
            indicatorColor: AuthTheme.green,
            tabs: [
              Tab(text: 'Activities'),
              Tab(text: 'AI Packs'),
            ],
          ),
        ),
        body: Container(
          decoration: AuthTheme.pageBackground,
          child: TabBarView(
            children: [
              const LearnCatalogPage(),
              ActivitiesPage(
                initialSubject: initialSubject,
                autoGenerate: autoGenerate,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
