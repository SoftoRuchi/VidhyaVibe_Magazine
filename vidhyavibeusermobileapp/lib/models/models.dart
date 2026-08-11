class UserProfile {
  UserProfile({
    required this.id,
    required this.email,
    this.name,
    this.phone,
    this.deliveryAddress,
    this.isAdmin = false,
    this.guardians = const [],
  });

  final int id;
  final String email;
  final String? name;
  final String? phone;
  final String? deliveryAddress;
  final bool isAdmin;
  final List<Guardian> guardians;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final guardiansRaw = json['guardians'];
    return UserProfile(
      id: _asInt(json['id']) ?? 0,
      email: json['email']?.toString() ?? '',
      name: json['name']?.toString(),
      phone: json['phone']?.toString(),
      deliveryAddress: json['deliveryAddress']?.toString(),
      isAdmin: json['isAdmin'] == true,
      guardians: guardiansRaw is List
          ? guardiansRaw
              .whereType<Map>()
              .map((g) => Guardian.fromJson(Map<String, dynamic>.from(g)))
              .toList()
          : const [],
    );
  }

  String get displayName {
    if (name != null && name!.trim().isNotEmpty) return name!.trim();
    if (guardians.isNotEmpty && guardians.first.name.trim().isNotEmpty) {
      return guardians.first.name.trim();
    }
    return email;
  }
}

class Guardian {
  Guardian({
    required this.id,
    required this.name,
    this.phone,
    this.relation,
  });

  final int id;
  final String name;
  final String? phone;
  final String? relation;

  factory Guardian.fromJson(Map<String, dynamic> json) {
    return Guardian(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString(),
      relation: json['relation']?.toString(),
    );
  }
}

class ReaderChild {
  ReaderChild({
    required this.id,
    required this.name,
    this.age,
    this.dob,
    this.className,
    this.schoolName,
    this.schoolCity,
    this.deliveryMode,
  });

  final int id;
  final String name;
  final int? age;
  final String? dob;
  final String? className;
  final String? schoolName;
  final String? schoolCity;
  final String? deliveryMode;

  factory ReaderChild.fromJson(Map<String, dynamic> json) {
    return ReaderChild(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? '',
      age: _asInt(json['age']),
      dob: json['dob']?.toString(),
      className: json['className']?.toString(),
      schoolName: json['schoolName']?.toString(),
      schoolCity: json['schoolCity']?.toString(),
      deliveryMode: json['deliveryMode']?.toString(),
    );
  }
}

class MagazineSummary {
  MagazineSummary({
    required this.id,
    required this.title,
    this.slug,
    this.description,
    this.category,
    this.image,
    this.coverKey,
    this.sampleEditionId,
  });

  final int id;
  final String title;
  final String? slug;
  final String? description;
  final String? category;
  final String? image;
  final String? coverKey;
  final int? sampleEditionId;

  String? get coverUrl {
    if (image != null && image!.isNotEmpty) return image;
    if (coverKey != null && coverKey!.isNotEmpty) return coverKey;
    return null;
  }

  factory MagazineSummary.fromJson(Map<String, dynamic> json) {
    return MagazineSummary(
      id: _asInt(json['id']) ?? 0,
      title: json['title']?.toString() ?? 'Magazine',
      slug: json['slug']?.toString(),
      description: json['description']?.toString(),
      category: json['category']?.toString() ?? json['ageGroupName']?.toString(),
      image: json['image']?.toString() ?? json['coverUrl']?.toString(),
      coverKey: json['coverKey']?.toString(),
      sampleEditionId: _asInt(json['sampleEditionId']),
    );
  }
}

class EditionSummary {
  EditionSummary({
    required this.id,
    required this.magazineId,
    this.volume,
    this.issueNumber,
    this.description,
    this.publishedAt,
    this.pages,
    this.coverUrl,
    this.hasSample = false,
    this.sampleUrl,
  });

  final int id;
  final int magazineId;
  final int? volume;
  final int? issueNumber;
  final String? description;
  final String? publishedAt;
  final int? pages;
  final String? coverUrl;
  final bool hasSample;
  final String? sampleUrl;

  String get label {
    final parts = <String>[];
    if (volume != null) parts.add('Vol $volume');
    if (issueNumber != null) parts.add('Issue $issueNumber');
    if (parts.isEmpty) return 'Edition #$id';
    return parts.join(' · ');
  }

  factory EditionSummary.fromJson(Map<String, dynamic> json) {
    return EditionSummary(
      id: _asInt(json['id']) ?? 0,
      magazineId: _asInt(json['magazineId']) ?? 0,
      volume: _asInt(json['volume']),
      issueNumber: _asInt(json['issueNumber']),
      description: json['description']?.toString(),
      publishedAt: json['publishedAt']?.toString(),
      pages: _asInt(json['pages']),
      coverUrl: json['coverUrl']?.toString() ?? json['coverKey']?.toString(),
      hasSample: json['hasSample'] == true,
      sampleUrl: json['sampleUrl']?.toString(),
    );
  }
}

class LibraryItem {
  LibraryItem({
    required this.accessType,
    required this.magazineId,
    required this.title,
    this.editionId,
    this.slug,
    this.coverKey,
    this.volume,
    this.issueNumber,
    this.publishedAt,
  });

  final String accessType; // subscription | purchase
  final int magazineId;
  final String title;
  final int? editionId;
  final String? slug;
  final String? coverKey;
  final int? volume;
  final int? issueNumber;
  final String? publishedAt;

  String get subtitle {
    final parts = <String>[];
    if (volume != null) parts.add('Vol $volume');
    if (issueNumber != null) parts.add('Issue $issueNumber');
    parts.add(accessType == 'purchase' ? 'Purchased' : 'Subscribed');
    return parts.join(' · ');
  }

  factory LibraryItem.fromJson(Map<String, dynamic> json) {
    return LibraryItem(
      accessType: json['accessType']?.toString() ??
          json['type']?.toString() ??
          'subscription',
      magazineId: _asInt(json['magazineId']) ?? 0,
      title: json['title']?.toString() ?? 'Magazine',
      editionId: _asInt(json['editionId']),
      slug: json['slug']?.toString(),
      coverKey: json['coverKey']?.toString() ?? json['coverUrl']?.toString(),
      volume: _asInt(json['volume']),
      issueNumber: _asInt(json['issueNumber']),
      publishedAt: json['publishedAt']?.toString(),
    );
  }
}

class SubscriptionPlan {
  SubscriptionPlan({
    required this.id,
    required this.name,
    this.slug,
    this.description,
    this.minMonths = 12,
    this.maxMonths,
    this.price,
    this.currency = 'INR',
    this.prices = const {},
  });

  final int id;
  final String name;
  final String? slug;
  final String? description;
  final int minMonths;
  final int? maxMonths;
  final num? price;
  final String currency;
  final Map<String, PlanPrice> prices;

  int get defaultMonths {
    final max = maxMonths;
    if (max != null && minMonths == max) return max;
    return minMonths >= 12 ? minMonths : (minMonths < 12 ? 12 : minMonths);
  }

  num priceFor(String deliveryMode) {
    final specific = prices[deliveryMode]?.price;
    if (specific != null) return specific;
    return price ?? 0;
  }

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    final pricesRaw = json['prices'];
    final map = <String, PlanPrice>{};
    if (pricesRaw is Map) {
      pricesRaw.forEach((key, value) {
        if (value is Map) {
          map[key.toString()] =
              PlanPrice.fromJson(Map<String, dynamic>.from(value));
        }
      });
    }
    return SubscriptionPlan(
      id: _asInt(json['id']) ?? 0,
      name: json['name']?.toString() ?? 'Plan',
      slug: json['slug']?.toString(),
      description: json['description']?.toString(),
      minMonths: _asInt(json['minMonths']) ?? 12,
      maxMonths: _asInt(json['maxMonths']),
      price: json['price'] is num ? json['price'] as num : num.tryParse('${json['price']}'),
      currency: json['currency']?.toString() ?? 'INR',
      prices: map,
    );
  }
}

class PlanPrice {
  PlanPrice({required this.price, this.currency = 'INR'});

  final num price;
  final String currency;

  factory PlanPrice.fromJson(Map<String, dynamic> json) {
    return PlanPrice(
      price: json['price'] is num
          ? json['price'] as num
          : num.tryParse('${json['price']}') ?? 0,
      currency: json['currency']?.toString() ?? 'INR',
    );
  }
}

int? _asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  return int.tryParse(v.toString());
}
