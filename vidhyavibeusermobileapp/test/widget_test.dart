import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:vidhyavibeusermobileapp/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Auth gate shows login when logged out', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const VidhyaVibeApp());
    await tester.pumpAndSettle();

    expect(find.text('VidhyaVibe'), findsOneWidget);
    expect(find.text('Welcome Back'), findsOneWidget);
    expect(find.text('Log In'), findsOneWidget);
  });
}
