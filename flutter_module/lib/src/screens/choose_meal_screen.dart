import 'package:flutter/material.dart';

import '../models/reward_progress.dart';
import '../services/reward_api_client.dart';
import '../services/reward_config.dart';
import '../services/reward_flow.dart';

/// Shown right after a scanned QR is confirmed valid. The customer decides
/// here which reward card this purchase counts toward - staff never picked
/// one at print time, so this screen is the only place that choice is made.
class ChooseMealScreen extends StatefulWidget {
  final RewardConfig config;
  final String token;

  const ChooseMealScreen({super.key, required this.config, required this.token});

  @override
  State<ChooseMealScreen> createState() => _ChooseMealScreenState();
}

class _ChooseMealScreenState extends State<ChooseMealScreen> {
  late final RewardApiClient _client = RewardApiClient(widget.config);
  late Future<List<RewardImageInfo>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _client.getRewardImages();
  }

  Future<void> _choose(RewardImageInfo image) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    await redeemChosenRewardAndNavigate(context, widget.config, widget.token, image.id);
    if (mounted) setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Which meal is this for?')),
      body: FutureBuilder<List<RewardImageInfo>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            if (snapshot.hasError) {
              return Center(child: Text('Failed to load meals: ${snapshot.error}'));
            }
            return const Center(child: CircularProgressIndicator());
          }

          final images = snapshot.data!;
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.9,
            ),
            itemCount: images.length,
            itemBuilder: (context, index) {
              final image = images[index];
              return InkWell(
                onTap: _submitting ? null : () => _choose(image),
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Expanded(
                        child: Image.network(
                          '${widget.config.apiBaseUrl}${image.imageUrl}',
                          fit: BoxFit.cover,
                          width: double.infinity,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(image.name),
                      ),
                    ],
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
