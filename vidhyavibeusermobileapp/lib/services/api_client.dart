import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/apiConfig.dart';
import 'auth_storage.dart';

class ApiClient {
  ApiClient._();

  static Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth) {
      final token = await AuthStorage.getAccessToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  static Future<http.Response> get(String url, {bool auth = true}) async {
    return http.get(Uri.parse(url), headers: await _headers(auth: auth));
  }

  static Future<http.Response> post(
    String url, {
    Map<String, dynamic>? body,
    bool auth = true,
    Duration? timeout,
  }) async {
    final future = http.post(
      Uri.parse(url),
      headers: await _headers(auth: auth),
      body: body == null ? null : jsonEncode(body),
    );
    if (timeout == null) return future;
    return future.timeout(timeout);
  }

  static Future<http.Response> put(
    String url, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return http.put(
      Uri.parse(url),
      headers: await _headers(auth: auth),
      body: body == null ? null : jsonEncode(body),
    );
  }

  static Future<http.Response> delete(String url, {bool auth = true}) async {
    return http.delete(Uri.parse(url), headers: await _headers(auth: auth));
  }

  static Map<String, dynamic> decodeMap(http.Response response) {
    if (response.body.isEmpty) return {};
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return {};
  }

  static List<dynamic> decodeList(http.Response response) {
    if (response.body.isEmpty) return [];
    final decoded = jsonDecode(response.body);
    if (decoded is List) return decoded;
    return [];
  }

  static bool isOk(http.Response response) =>
      response.statusCode >= 200 && response.statusCode < 300;

  // Auth / profile
  static Future<http.Response> getMe() => get(ApiConfig.meUrl);

  static Future<http.Response> updateMe(Map<String, dynamic> body) =>
      put(ApiConfig.meUrl, body: body);

  static Future<http.Response> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      post(ApiConfig.changePasswordUrl, body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  // Readers
  static Future<http.Response> listReaders() => get(ApiConfig.readersUrl);

  static Future<http.Response> createReader(Map<String, dynamic> body) =>
      post(ApiConfig.readersUrl, body: body);

  static Future<http.Response> updateReader(
    int id,
    Map<String, dynamic> body,
  ) =>
      put(ApiConfig.readerUrl(id), body: body);

  // Magazines
  static Future<http.Response> listMagazines() =>
      get(ApiConfig.magazinesUrl, auth: false);

  static Future<http.Response> getMagazine(Object idOrSlug) =>
      get(ApiConfig.magazineUrl(idOrSlug), auth: false);

  static Future<http.Response> listEditions(Object idOrSlug) =>
      get(ApiConfig.magazineEditionsUrl(idOrSlug), auth: false);

  // Library / plans / payments
  static Future<http.Response> getLibrary({int? readerId}) =>
      get(ApiConfig.libraryUrl(readerId: readerId));

  static Future<http.Response> checkSubscription(int magazineId) =>
      get(ApiConfig.subscriptionCheckUrl(magazineId));

  static Future<http.Response> listPlans({int? magazineId}) =>
      get(ApiConfig.plansUrl(magazineId: magazineId), auth: false);

  static Future<http.Response> createPaymentOrder(Map<String, dynamic> body) =>
      post(ApiConfig.createOrderUrl, body: body);

  static Future<http.Response> confirmRazorpay(Map<String, dynamic> body) =>
      post(ApiConfig.razorpayConfirmUrl, body: body);

  static Future<http.Response> editionPages(int editionId, {bool sample = false}) =>
      get(
        sample
            ? ApiConfig.editionSamplePagesUrl(editionId)
            : ApiConfig.editionPagesUrl(editionId),
        auth: !sample,
      );

  /// Download PDF bytes (sample is public; full needs auth).
  static Future<http.Response> downloadEditionPdf(
    int editionId, {
    bool sample = false,
  }) async {
    final url = sample
        ? ApiConfig.editionSamplePdfUrl(editionId)
        : ApiConfig.editionPdfUrl(editionId);
    final headers = await _headers(auth: !sample);
    headers['Accept'] = 'application/pdf,*/*';
    return http.get(Uri.parse(url), headers: headers);
  }

  static Future<http.Response> activitiesMeta() =>
      get(ApiConfig.activitiesMetaUrl, auth: false);

  /// AI pack generation can take a while — use a long timeout.
  static Future<http.Response> generateActivity(Map<String, dynamic> body) =>
      post(
        ApiConfig.activitiesGenerateUrl,
        body: body,
        auth: false,
        timeout: const Duration(seconds: 90),
      );
}
