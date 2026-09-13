import 'package:flutter/material.dart';

import 'auth_widgets.dart';

String courseCountLabel(int count, String singular, {String? plural}) {
  final word = count == 1 ? singular : (plural ?? '${singular}s');
  return '$count $word';
}

class CourseBrowseBody extends StatelessWidget {
  const CourseBrowseBody({
    super.key,
    required this.loading,
    required this.onRetry,
    this.error,
    required this.child,
  });

  final bool loading;
  final String? error;
  final Future<void> Function() onRetry;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator(color: AuthTheme.green));
    }
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.menu_book_outlined, size: 40, color: AuthTheme.mutedBrown),
              const SizedBox(height: 12),
              Text(
                error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AuthTheme.mutedBrown, height: 1.4),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: onRetry,
                style: AuthTheme.primaryButtonStyle,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(onRefresh: onRetry, color: AuthTheme.green, child: child);
  }
}

class CourseHeroCard extends StatelessWidget {
  const CourseHeroCard({
    super.key,
    this.kicker,
    required this.title,
    this.subtitle,
    this.chips = const [],
  });

  final String? kicker;
  final String title;
  final String? subtitle;
  final List<String> chips;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: AuthTheme.brown.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (kicker != null && kicker!.trim().isNotEmpty)
            Text(
              kicker!.toUpperCase(),
              style: const TextStyle(
                color: AuthTheme.green,
                fontWeight: FontWeight.w700,
                fontSize: 11,
                letterSpacing: 0.7,
              ),
            ),
          if (kicker != null && kicker!.trim().isNotEmpty) const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'serif',
              fontSize: 26,
              height: 1.15,
              fontWeight: FontWeight.w800,
              color: AuthTheme.brown,
            ),
          ),
          if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              subtitle!,
              style: const TextStyle(color: AuthTheme.mutedBrown, height: 1.45, fontSize: 14),
            ),
          ],
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: chips.map((label) => CourseMetaChip(label: label)).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class CourseMetaChip extends StatelessWidget {
  const CourseMetaChip({super.key, required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF3E6D2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: AuthTheme.green),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: const TextStyle(
              color: AuthTheme.brown,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class CourseSectionLabel extends StatelessWidget {
  const CourseSectionLabel(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
      child: Text(
        label,
        style: const TextStyle(
          color: AuthTheme.brown,
          fontWeight: FontWeight.w800,
          fontSize: 15,
        ),
      ),
    );
  }
}

class CourseNavCard extends StatelessWidget {
  const CourseNavCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
    this.icon,
    this.muted = false,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final String? badge;
  final IconData? icon;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final ink = muted ? AuthTheme.mutedBrown.withValues(alpha: 0.7) : AuthTheme.brown;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white.withValues(alpha: muted ? 0.62 : 0.94),
        elevation: 0,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AuthTheme.brown.withValues(alpha: muted ? 0.08 : 0.12)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: muted ? const Color(0xFFEDE3D4) : const Color(0xFFE7F3EA),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: badge != null
                        ? Text(
                            badge!,
                            style: TextStyle(
                              color: muted ? AuthTheme.mutedBrown : AuthTheme.green,
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                            ),
                          )
                        : Icon(
                            icon ?? Icons.menu_book_outlined,
                            color: muted ? AuthTheme.mutedBrown : AuthTheme.green,
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            color: ink,
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: TextStyle(
                            color: AuthTheme.mutedBrown.withValues(alpha: muted ? 0.8 : 1),
                            fontSize: 13,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF3E6D2),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.chevron_right, color: ink, size: 20),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class CourseEmptyCard extends StatelessWidget {
  const CourseEmptyCard({super.key, required this.message, this.icon});

  final String message;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.1), style: BorderStyle.solid),
      ),
      child: Column(
        children: [
          Icon(icon ?? Icons.auto_stories_outlined, size: 36, color: AuthTheme.mutedBrown),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AuthTheme.mutedBrown, height: 1.4),
          ),
        ],
      ),
    );
  }
}
