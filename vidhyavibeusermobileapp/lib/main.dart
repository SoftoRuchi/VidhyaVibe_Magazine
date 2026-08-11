import 'package:flutter/material.dart';

import 'screens/login_page.dart';
import 'screens/main_shell.dart';
import 'screens/post_login_setup_page.dart';
import 'services/auth_storage.dart';
import 'widgets/auth_widgets.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const VidhyaVibeApp());
}

class VidhyaVibeApp extends StatelessWidget {
  const VidhyaVibeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VidhyaVibe',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: AuthTheme.green,
          primary: AuthTheme.green,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: AuthTheme.appBar,
          foregroundColor: AuthTheme.appBarForeground,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          iconTheme: IconThemeData(color: AuthTheme.appBarForeground),
          titleTextStyle: TextStyle(
            color: AuthTheme.appBarForeground,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
        ),
      ),
      home: const AuthGate(),
    );
  }
}

/// Routes to login, post-login setup, or home based on saved session.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late Future<_BootTarget> _bootFuture;

  @override
  void initState() {
    super.initState();
    _bootFuture = _resolveBootTarget();
  }

  Future<_BootTarget> _resolveBootTarget() async {
    final loggedIn = await AuthStorage.isLoggedIn();
    if (!loggedIn) return _BootTarget.login;
    if (await AuthStorage.shouldShowPostLoginSetup()) {
      return _BootTarget.setup;
    }
    return _BootTarget.home;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_BootTarget>(
      future: _bootFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        switch (snapshot.data ?? _BootTarget.login) {
          case _BootTarget.home:
            return const MainShell();
          case _BootTarget.setup:
            return const PostLoginSetupPage();
          case _BootTarget.login:
            return const LoginPage();
        }
      },
    );
  }
}

enum _BootTarget { login, setup, home }
