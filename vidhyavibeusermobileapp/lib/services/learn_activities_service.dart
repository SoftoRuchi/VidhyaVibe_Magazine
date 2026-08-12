import '../config/apiConfig.dart';
import '../models/learn_activity_models.dart';
import 'api_client.dart';

class LearnActivitiesService {
  LearnActivitiesService._();

  static Future<List<LearnSubject>> subjects() async {
    final res = await ApiClient.get(ApiConfig.learnSubjectsUrl, auth: false)
        .timeout(const Duration(seconds: 20));
    if (!ApiClient.isOk(res)) {
      final data = ApiClient.decodeMap(res);
      throw Exception(
        data['message']?.toString() ??
            data['error']?.toString() ??
            'Could not load subjects (${res.statusCode})',
      );
    }
    final data = ApiClient.decodeMap(res);
    final list = data['subjects'];
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => LearnSubject.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<List<LearnActivitySummary>> list({
    String? ageBand,
    int? age,
    int? subjectId,
    String? subjectSlug,
    String? activityType,
  }) async {
    // Do not send ageBand to the server yet — production hangs on that query.
    // Filter by age on the client until the fixed API is deployed.
    final all = await _fetchList(
      subjectId: subjectId,
      subjectSlug: subjectSlug,
      activityType: activityType,
    );
    if (ageBand == null || ageBand.isEmpty) {
      return all.where((a) => a.progressStatus != 'COMPLETED').toList();
    }
    return all
        .where((a) => a.progressStatus != 'COMPLETED')
        .where((a) => a.ageBands.isEmpty || a.ageBands.contains(ageBand))
        .toList();
  }

  static Future<List<LearnActivitySummary>> _fetchList({
    String? ageBand,
    int? age,
    int? subjectId,
    String? subjectSlug,
    String? activityType,
  }) async {
    final q = <String, String>{};
    if (ageBand != null && ageBand.isNotEmpty) q['ageBand'] = ageBand;
    if (age != null) q['age'] = '$age';
    if (subjectId != null) q['subjectId'] = '$subjectId';
    if (subjectSlug != null && subjectSlug.isNotEmpty) {
      q['subjectSlug'] = subjectSlug;
    }
    if (activityType != null && activityType.isNotEmpty) {
      q['activityType'] = activityType;
    }
    final qs = q.entries
        .map((e) =>
            '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    final url =
        qs.isEmpty ? ApiConfig.learnActivitiesUrl : '${ApiConfig.learnActivitiesUrl}?$qs';
    final res = await ApiClient.get(url, auth: true)
        .timeout(const Duration(seconds: 20));
    if (!ApiClient.isOk(res)) {
      final data = ApiClient.decodeMap(res);
      throw Exception(
        data['message']?.toString() ??
            data['error']?.toString() ??
            'Could not load activities (${res.statusCode})',
      );
    }
    final data = ApiClient.decodeMap(res);
    final list = data['items'];
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => LearnActivitySummary.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<LearnActivityDetail> getById(int id) async {
    final res = await ApiClient.get(ApiConfig.learnActivityUrl(id), auth: true);
    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(data['message'] ?? data['error'] ?? 'Activity not found');
    }
    return LearnActivityDetail.fromJson(data);
  }

  static Future<void> start(int id, {int? readerId}) async {
    final res = await ApiClient.post(
      ApiConfig.learnActivityStartUrl(id),
      body: {if (readerId != null) 'readerId': readerId},
      auth: true,
    );
    if (!ApiClient.isOk(res)) {
      final data = ApiClient.decodeMap(res);
      throw Exception(
        data['message']?.toString() ??
            data['error']?.toString() ??
            'Could not start activity',
      );
    }
  }

  static Future<LearnCompleteResult> complete(
    int id, {
    required Map<String, dynamic> response,
    int? readerId,
    int? timeSpentSec,
  }) async {
    final res = await ApiClient.post(
      ApiConfig.learnActivityCompleteUrl(id),
      body: {
        'response': response,
        if (readerId != null) 'readerId': readerId,
        if (timeSpentSec != null) 'timeSpentSec': timeSpentSec,
      },
      auth: true,
    );
    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(
        data['message']?.toString() ??
            data['error']?.toString() ??
            'Could not complete activity',
      );
    }
    return LearnCompleteResult.fromJson(data);
  }

  static Future<int> walletBalance() async {
    final res = await ApiClient.get(ApiConfig.learnWalletUrl, auth: true)
        .timeout(const Duration(seconds: 20));
    if (!ApiClient.isOk(res)) return 0;
    final data = ApiClient.decodeMap(res);
    return int.tryParse('${data['balance']}') ?? 0;
  }
}
