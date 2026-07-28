import 'package:flutter/material.dart';

import '../models/reward_progress.dart';
import '../services/reward_api_client.dart';
import '../services/reward_config.dart';
import '../widgets/sectioned_reward_image.dart';
import 'reward_progress_screen.dart';

/// Lists every reward card the customer has progress on - one per meal type
/// they've bought at least once. Tap a card to see it full-size.
class MyRewardsScreen extends StatefulWidget {
  final RewardConfig config;

  const MyRewardsScreen({super.key, required this.config});

  @override
  State<MyRewardsScreen> createState() => _MyRewardsScreenState();
}

class _MyRewardsScreenState extends State<MyRewardsScreen> {
  late final RewardApiClient _client = RewardApiClient(widget.config);
  late Future<List<RewardProgress>> _future;

  @override
  void initState() {
    super.initState();
    _future = _client.getAllProgress(widget.config.getCustomerId());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Rewards')),
      body: FutureBuilder<List<RewardProgress>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            if (snapshot.hasError) {
              return Center(child: Text('Failed to load rewards: ${snapshot.error}'));
            }
            return const Center(child: CircularProgressIndicator());
          }

          final cards = snapshot.data!;
          if (cards.isEmpty) {
            return const Center(child: Text('Scan a QR code to start your first reward card.'));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: cards.length,
            itemBuilder: (context, index) {
              final card = cards[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: InkWell(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => RewardProgressScreen(config: widget.config, progress: card),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionedRewardImage(
                          image: NetworkImage('${widget.config.apiBaseUrl}${card.rewardImage.imageUrl}'),
                          rows: card.rewardImage.rows,
                          cols: card.rewardImage.cols,
                          unlockedSections: card.unlockedSections,
                          aspectRatio: 2,
                        ),
                        const SizedBox(height: 8),
                        Text(card.rewardImage.name, style: Theme.of(context).textTheme.titleMedium),
                        Text(
                          card.completed
                              ? 'Completed! 🎉'
                              : '${card.unlockedSections.length} / ${card.rewardImage.totalSections} sections unlocked',
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
