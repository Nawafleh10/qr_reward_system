class RewardImageInfo {
  final int id;
  final String name;
  final String imageUrl;
  final int totalSections;
  final int rows;
  final int cols;

  const RewardImageInfo({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.totalSections,
    required this.rows,
    required this.cols,
  });

  factory RewardImageInfo.fromJson(Map<String, dynamic> json) {
    return RewardImageInfo(
      id: json['id'] as int,
      name: json['name'] as String,
      imageUrl: json['imageUrl'] as String,
      totalSections: json['totalSections'] as int,
      rows: json['rows'] as int,
      cols: json['cols'] as int,
    );
  }
}

class RewardProgress {
  final int id;
  final String customerId;
  final bool completed;
  final Set<int> unlockedSections;
  final RewardImageInfo rewardImage;

  const RewardProgress({
    required this.id,
    required this.customerId,
    required this.completed,
    required this.unlockedSections,
    required this.rewardImage,
  });

  factory RewardProgress.fromJson(Map<String, dynamic> json) {
    return RewardProgress(
      id: json['id'] as int,
      customerId: json['customerId'] as String,
      completed: json['completed'] as bool,
      unlockedSections: (json['unlockedSections'] as List<dynamic>).map((e) => e as int).toSet(),
      rewardImage: RewardImageInfo.fromJson(json['rewardImage'] as Map<String, dynamic>),
    );
  }
}
