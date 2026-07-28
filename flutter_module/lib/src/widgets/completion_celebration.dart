import 'dart:math';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';

/// Shown once a customer unlocks every section of their reward image.
class CompletionCelebration extends StatefulWidget {
  final Widget completedImage;
  final VoidCallback? onDismiss;

  const CompletionCelebration({super.key, required this.completedImage, this.onDismiss});

  @override
  State<CompletionCelebration> createState() => _CompletionCelebrationState();
}

class _CompletionCelebrationState extends State<CompletionCelebration> {
  late final ConfettiController _confettiController;

  @override
  void initState() {
    super.initState();
    _confettiController = ConfettiController(duration: const Duration(seconds: 3))..play();
  }

  @override
  void dispose() {
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            widget.completedImage,
            const SizedBox(height: 24),
            Text(
              'Congratulations! You have completed the reward and won.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            if (widget.onDismiss != null)
              ElevatedButton(onPressed: widget.onDismiss, child: const Text('Awesome!')),
          ],
        ),
        ConfettiWidget(
          confettiController: _confettiController,
          blastDirection: pi / 2,
          numberOfParticles: 30,
          maxBlastForce: 20,
          minBlastForce: 8,
          emissionFrequency: 0.04,
          shouldLoop: false,
        ),
      ],
    );
  }
}
