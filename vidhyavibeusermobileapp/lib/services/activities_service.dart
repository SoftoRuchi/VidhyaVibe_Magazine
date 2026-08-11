import 'dart:async';

import '../models/activity_models.dart';
import 'api_client.dart';

class ActivityGenerateResult {
  ActivityGenerateResult({
    required this.pack,
    required this.aiEnabled,
  });

  final ActivityPack pack;
  final bool aiEnabled;
}

/// Mobile ↔ API bridge for VidhyaVibe Learn activity packs.
class ActivitiesService {
  ActivitiesService._();

  static Future<ActivityGenerateResult> generatePack({
    required String ageGroup,
    required String subject,
    required String difficulty,
  }) async {
    late final dynamic res;
    try {
      res = await ApiClient.generateActivity({
        'ageGroup': ageGroup,
        'subject': subject,
        'difficulty': difficulty,
      });
    } on TimeoutException {
      throw Exception(
        'AI is taking too long. Check your connection and try again.',
      );
    }

    final data = ApiClient.decodeMap(res);
    if (!ApiClient.isOk(res)) {
      throw Exception(
        data['message']?.toString() ??
            data['error']?.toString() ??
            'Could not generate activity pack (${res.statusCode})',
      );
    }

    final packRaw = data['pack'] ?? data['activityPack'];
    if (packRaw is! Map) {
      throw Exception('Invalid pack response from server');
    }

    final map = Map<String, dynamic>.from(packRaw);
    map['subject'] = map['subject']?.toString().isNotEmpty == true
        ? map['subject']
        : subject;
    map['ageGroup'] = map['ageGroup']?.toString().isNotEmpty == true
        ? map['ageGroup']
        : ageGroup;
    map['difficulty'] = map['difficulty']?.toString().isNotEmpty == true
        ? map['difficulty']
        : difficulty;

    final pack = ActivityPack.fromJson(map);
    if (pack.activities.isEmpty) {
      throw Exception('AI returned an empty activity pack');
    }

    return ActivityGenerateResult(
      pack: pack,
      aiEnabled: data['aiEnabled'] == true ||
          pack.source == 'ai' ||
          pack.source == 'openai' ||
          pack.source == 'gemini' ||
          pack.source == 'groq',
    );
  }
}
