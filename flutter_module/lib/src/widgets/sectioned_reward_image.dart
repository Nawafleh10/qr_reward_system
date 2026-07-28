import 'package:flutter/material.dart';

/// Renders [image] divided into a [rows] x [cols] grid. Locked sections show
/// in grayscale, unlocked sections show in full color. This is a pure
/// display widget - it has no notion of how sections get unlocked, that
/// decision always comes from the backend.
class SectionedRewardImage extends StatelessWidget {
  final ImageProvider image;
  final int rows;
  final int cols;
  final Set<int> unlockedSections;
  final double aspectRatio;

  const SectionedRewardImage({
    super.key,
    required this.image,
    required this.rows,
    required this.cols,
    required this.unlockedSections,
    this.aspectRatio = 1,
  });

  static const List<double> _grayscaleMatrix = <double>[
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ];

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: ClipRect(
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColorFiltered(
              colorFilter: const ColorFilter.matrix(_grayscaleMatrix),
              child: Image(image: image, fit: BoxFit.cover),
            ),
            ClipPath(
              clipper: _SectionsClipper(rows: rows, cols: cols, unlockedSections: unlockedSections),
              child: Image(image: image, fit: BoxFit.cover),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionsClipper extends CustomClipper<Path> {
  final int rows;
  final int cols;
  final Set<int> unlockedSections;

  _SectionsClipper({required this.rows, required this.cols, required this.unlockedSections});

  @override
  Path getClip(Size size) {
    final path = Path();
    final cellWidth = size.width / cols;
    final cellHeight = size.height / rows;

    for (final index in unlockedSections) {
      if (index < 0 || index >= rows * cols) continue;
      final row = index ~/ cols;
      final col = index % cols;
      path.addRect(Rect.fromLTWH(col * cellWidth, row * cellHeight, cellWidth, cellHeight));
    }

    return path;
  }

  @override
  bool shouldReclip(covariant _SectionsClipper oldClipper) {
    return rows != oldClipper.rows ||
        cols != oldClipper.cols ||
        unlockedSections.length != oldClipper.unlockedSections.length ||
        !unlockedSections.containsAll(oldClipper.unlockedSections);
  }
}
