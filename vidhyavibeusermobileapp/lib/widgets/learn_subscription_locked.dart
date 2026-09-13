import 'package:flutter/material.dart';

import 'auth_widgets.dart';

/// Shown when Learn APIs return 403 `subscription_required`.
class LearnSubscriptionLockedPanel extends StatelessWidget {
  const LearnSubscriptionLockedPanel({
    super.key,
    this.message =
        'Take a magazine subscription to unlock learning activities for this account.',
    required this.onSubscribe,
  });

  final String message;
  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.lock_outline,
              size: 56,
              color: AuthTheme.brown.withValues(alpha: 0.7),
            ),
            const SizedBox(height: 16),
            const Text(
              'Activities are for subscribers',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: AuthTheme.brown,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AuthTheme.mutedBrown,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            AuthPrimaryButton(
              label: 'Subscribe',
              loading: false,
              onPressed: onSubscribe,
            ),
          ],
        ),
      ),
    );
  }
}
