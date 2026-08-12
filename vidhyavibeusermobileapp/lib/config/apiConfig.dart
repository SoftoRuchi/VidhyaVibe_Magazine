/// API configuration for VidhyaVibe user mobile app.
class ApiConfig {
  ApiConfig._();

  /// Backend API origin (no trailing slash).
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://readerapi.vidhyavibe.in',
  );

  /// Public Razorpay key (never put the secret in the app).
  static const String razorpayKeyId = String.fromEnvironment(
    'RAZORPAY_KEY_ID',
    defaultValue: 'rzp_live_SyJ3Zz99uEkEUf',
  );

  static const String apiPrefix = '/api';

  static String get apiBaseUrl => '$baseUrl$apiPrefix';

  static String url(String path) {
    final suffix = path.startsWith('/') ? path : '/$path';
    return '$apiBaseUrl$suffix';
  }

  /// Absolute URL for API-relative paths like `/api/assets/serve?key=...`
  static String absoluteUrl(String? pathOrUrl) {
    if (pathOrUrl == null || pathOrUrl.isEmpty) return '';
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith('/api')) return '$baseUrl$pathOrUrl';
    if (pathOrUrl.startsWith('/')) return '$baseUrl$pathOrUrl';
    return url('/assets/serve?key=${Uri.encodeComponent(pathOrUrl)}');
  }

  // Auth
  static String get loginUrl => url('/auth/login');
  static String get registerUrl => url('/auth/register');
  static String get refreshUrl => url('/auth/refresh');
  static String get meUrl => url('/auth/me');
  static String get changePasswordUrl => url('/auth/change-password');
  static String get forgotPasswordUrl => url('/auth/forgot-password');
  static String get resetPasswordUrl => url('/auth/reset-password');

  // Readers
  static String get readersUrl => url('/readers');
  static String readerUrl(int id) => url('/readers/$id');

  // Magazines / editions
  static String get magazinesUrl => url('/magazines');
  static String magazineUrl(Object idOrSlug) => url('/magazines/$idOrSlug');
  static String magazineEditionsUrl(Object idOrSlug) =>
      url('/magazines/$idOrSlug/editions');
  static String get ageGroupsUrl => url('/age-groups');
  static String editionInfoUrl(int id) => url('/editions/$id/info');
  static String editionPagesUrl(int id) => url('/editions/$id/pages');
  static String editionPdfUrl(int id) => url('/editions/$id/pdf');
  static String editionSamplePagesUrl(int id) =>
      url('/editions/$id/sample/pages');
  static String editionSamplePdfUrl(int id) => url('/editions/$id/sample');

  // Library / subscriptions
  static String libraryUrl({int? readerId}) {
    if (readerId == null) return url('/library');
    return url('/library?readerId=$readerId');
  }

  static String subscriptionCheckUrl(int magazineId) =>
      url('/subscriptions/check/$magazineId');

  static String plansUrl({int? magazineId}) {
    if (magazineId == null) return url('/subscriptions/plans');
    return url('/subscriptions/plans?magazineId=$magazineId');
  }

  // Payments
  static String get createOrderUrl => url('/payments/create-order');
  static String get razorpayConfirmUrl => url('/payments/razorpay/confirm');
  static String get validateCouponUrl => url('/payments/validate-coupon');

  // Learn / AI activities (generative packs)
  static String get activitiesMetaUrl => url('/activities/meta');
  static String get activitiesGenerateUrl => url('/activities/generate');

  // Learn / admin-configured activities
  static String get learnActivitiesUrl => url('/learn/activities');
  static String get learnSubjectsUrl => url('/learn/activities/subjects');
  static String get learnMyProgressUrl => url('/learn/activities/me/progress');
  static String get learnWalletUrl => url('/learn/activities/me/wallet');
  static String learnActivityUrl(Object id) => url('/learn/activities/$id');
  static String learnActivityStartUrl(Object id) =>
      url('/learn/activities/$id/start');
  static String learnActivityCompleteUrl(Object id) =>
      url('/learn/activities/$id/complete');
}
