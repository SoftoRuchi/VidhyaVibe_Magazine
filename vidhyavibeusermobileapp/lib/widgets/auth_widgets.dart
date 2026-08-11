import 'package:flutter/material.dart';

/// Shared colors and chrome for auth screens.
class AuthTheme {
  AuthTheme._();

  static const Color brown = Color(0xFF3D2914);
  static const Color mutedBrown = Color(0xFF5C4A3A);
  static const Color green = Color(0xFF2D7A3E);
  /// Shared light AppBar color for every screen.
  static const Color appBar = Color.fromARGB(255, 215, 193, 162);
  static const Color appBarForeground = Color(0xFF3D2914);
  static const Color logout = Color(0xFFC62828);

  static AppBar buildAppBar(
    String title, {
    List<Widget>? actions,
    PreferredSizeWidget? bottom,
    bool automaticallyImplyLeading = true,
  }) {
    return AppBar(
      title: Text(title),
      backgroundColor: appBar,
      foregroundColor: appBarForeground,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: automaticallyImplyLeading,
      actions: actions,
      bottom: bottom,
      iconTheme: const IconThemeData(color: appBarForeground),
      titleTextStyle: const TextStyle(
        color: appBarForeground,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  static const BoxDecoration pageBackground = BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color(0xFFF7F0E6),
        Color(0xFFE8D9C4),
        Color(0xFFDCC7A8),
      ],
    ),
  );

  static BoxDecoration cardDecoration = BoxDecoration(
    color: Colors.white.withValues(alpha: 0.82),
    borderRadius: BorderRadius.circular(22),
    border: Border.all(color: brown.withValues(alpha: 0.18)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.12),
        blurRadius: 28,
        offset: const Offset(0, 14),
      ),
    ],
  );

  static InputDecoration fieldDecoration({
    required String label,
    Widget? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
    );
  }

  static ButtonStyle primaryButtonStyle = ElevatedButton.styleFrom(
    backgroundColor: green,
    foregroundColor: Colors.white,
    disabledBackgroundColor: green.withValues(alpha: 0.6),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    elevation: 0,
  );
}

class AuthPageShell extends StatelessWidget {
  const AuthPageShell({
    super.key,
    required this.child,
    this.brandTitle = true,
  });

  final Widget child;
  final bool brandTitle;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: AuthTheme.pageBackground,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (brandTitle) ...[
                      const Text(
                        'VidhyaVibe',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'serif',
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                          color: AuthTheme.brown,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 28),
                    ],
                    child,
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AuthCard extends StatelessWidget {
  const AuthCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 28, 22, 24),
      decoration: AuthTheme.cardDecoration,
      child: child,
    );
  }
}

class AuthHeading extends StatelessWidget {
  const AuthHeading({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'serif',
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AuthTheme.brown,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          width: 160,
          height: 3,
          decoration: BoxDecoration(
            color: AuthTheme.brown,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          subtitle,
          style: const TextStyle(color: AuthTheme.mutedBrown, fontSize: 13),
        ),
      ],
    );
  }
}

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: AuthTheme.primaryButtonStyle,
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white,
                ),
              )
            : Text(
                label,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
      ),
    );
  }
}

String apiErrorMessage(
  Map<String, dynamic> data, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (data['message'] != null) return data['message'].toString();
  if (data['details'] != null) return data['details'].toString();
  final err = data['error'];
  if (err != null && err.toString().isNotEmpty) return err.toString();
  return fallback;
}
