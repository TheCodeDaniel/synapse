import * as path from 'path';
import { FlutterAnalyzer } from '../flutter-analyzer';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('FlutterAnalyzer architecture reasoning', () => {
  it('detects a Bloc-based project from class inheritance and the flutter_bloc dependency', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'bloc-project'));

    const graph = await analyzer.analyze();

    expect(graph.architecture.pattern).toBe('blocs');
    expect(graph.dependencies.keyPackages).toContain('flutter_bloc');
  });

  it('detects a Riverpod-based project from ConsumerWidget/ref.watch usage', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'riverpod-project'));

    const graph = await analyzer.analyze();

    expect(graph.architecture.pattern).toBe('riverpod');
  });

  it('falls back to the folder-based structural pattern when there is no state-management signal', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'clean-arch-setstate-project'));

    const graph = await analyzer.analyze();

    expect(graph.architecture.pattern).toBe('clean_architecture');
  });

  it('populates real feature-module metadata instead of always returning empty stubs', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'bloc-project'));

    const graph = await analyzer.analyze();

    const counterFeature = graph.architecture.folders.features['counter'];
    expect(counterFeature).toBeDefined();
    expect(counterFeature.hasBLoC).toBe(true);
    expect(counterFeature.hasWidgets).toBe(true);
  });

  it('does not throw when lib/ is missing (detectFolderStructure previously crashed with no guard)', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'no-lib-dir-project'));

    await expect(analyzer.analyze()).resolves.toBeDefined();
  });
});

describe('FlutterAnalyzer pubspec parsing (js-yaml based)', () => {
  it('keeps dependency_overrides isolated instead of leaking into dependencies/devDependencies', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'assets-and-overrides-project'));

    const graph = await analyzer.analyze();

    expect(graph.dependencies.dependencies).not.toHaveProperty('intl');
    expect(graph.dependencies.devDependencies).not.toHaveProperty('intl');
    // The override still changes http's resolved version in a real pub get,
    // but the *declared* dependency entry itself should be unaffected.
    expect(graph.dependencies.dependencies.http).toBe('^1.1.0');
  });

  it('normalizes SDK-style dependencies (e.g. { sdk: flutter }) to a readable string', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'assets-and-overrides-project'));

    const graph = await analyzer.analyze();

    expect(graph.dependencies.dependencies.flutter).toBe('sdk:flutter');
  });

  it('populates the Dart SDK constraint instead of leaving flutterSdk always blank', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'assets-and-overrides-project'));

    const graph = await analyzer.analyze();

    expect(graph.dependencies.flutterSdk).toBe('>=3.0.0 <4.0.0');
  });

  it('scanAssets classifies pubspec assets into images/fonts/others instead of always returning empty arrays', async () => {
    const analyzer = new FlutterAnalyzer(path.join(FIXTURES_DIR, 'assets-and-overrides-project'));

    const graph = await analyzer.analyze();

    expect(graph.assets.images).toContain('assets/images/logo.png');
    expect(graph.assets.others).toContain('assets/data/config.json');
    expect(graph.assets.fonts).toContain('assets/fonts/Roboto-Regular.ttf');
  });
});
