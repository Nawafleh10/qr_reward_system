import 'package:flutter/material.dart';

import '../models/reward_progress.dart';
import '../services/reward_config.dart';
import '../widgets/completion_celebration.dart';
import '../widgets/sectioned_reward_image.dart';

/// Read-only view of ONE reward card: unlocked sections, remaining
/// sections, and the completion celebration once that card is full. Always
/// shown a specific [progress] - either fresh off a scan, or picked from
/// [MyRewardsScreen] - since a customer can hold several cards at once and
/// this screen has no way to guess which one you mean.
class RewardProgressScreen extends StatelessWidget {
  final RewardConfig config;
  final RewardProgress progress;

  const RewardProgressScreen({super.key, required this.config, required this.progress});

  @override
  Widget build(BuildContext context) {
    final image = SectionedRewardImage(
      image: NetworkImage('${config.apiBaseUrl}${progress.rewardImage.imageUrl}'),
      rows: progress.rewardImage.rows,
      cols: progress.rewardImage.cols,
      unlockedSections: progress.unlockedSections,
    );

    return Scaffold(
      appBar: AppBar(title: Text(progress.rewardImage.name)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: SingleChildScrollView(
            child: progress.completed
                ? CompletionCelebration(completedImage: image)
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      image,
                      const SizedBox(height: 16),
                      Text(
                        '${progress.unlockedSections.length} / ${progress.rewardImage.totalSections} sections unlocked',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
