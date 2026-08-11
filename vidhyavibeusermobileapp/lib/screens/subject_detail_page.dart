import 'package:flutter/material.dart';

import '../data/learning_content.dart';
import '../widgets/auth_widgets.dart';

class SubjectDetailPage extends StatelessWidget {
  const SubjectDetailPage({super.key, required this.subject});

  final LearningSubject subject;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar(subject.title),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: subject.color.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: subject.color.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(subject.icon, color: subject.color),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          subject.tagline,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: subject.color,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    subject.description,
                    style: const TextStyle(
                      color: AuthTheme.mutedBrown,
                      height: 1.45,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Try these activities',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: AuthTheme.brown,
              ),
            ),
            const SizedBox(height: 10),
            ...subject.activities.map(
              (activity) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ActivityCard(
                  activity: activity,
                  accent: subject.color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.activity, required this.accent});

  final LearningActivity activity;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            activity.title,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: AuthTheme.brown,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            activity.summary,
            style: const TextStyle(
              color: AuthTheme.mutedBrown,
              height: 1.4,
              fontSize: 13.5,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _Chip(label: '${activity.minutes} min', color: accent),
              _Chip(label: activity.difficulty, color: accent),
              if (activity.needsAdult)
                const _Chip(label: 'Adult help', color: AuthTheme.logout),
              ...activity.skills.map(
                (s) => _Chip(label: s, color: AuthTheme.mutedBrown),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
