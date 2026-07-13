import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectIntegrator } from '../index';

function makeTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'di-integrator-'));
}

describe('ProjectIntegrator', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempProject();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('isRouteFile (via integrateGeneratedFiles)', () => {
    it('does not misclassify a widget file that merely contains "pages" as a substring', async () => {
      const integrator = new ProjectIntegrator(root);

      const result = await integrator.integrateGeneratedFiles([
        { filePath: 'lib/features/pages_selector/pages_selector_widget.dart', content: 'class X {}' },
      ]);

      expect(result.routesUpdated).toEqual([]);
    });

    it('does not misclassify a widget file named message_pages.dart', async () => {
      const integrator = new ProjectIntegrator(root);

      const result = await integrator.integrateGeneratedFiles([
        { filePath: 'lib/widgets/message_pages.dart', content: 'class X {}' },
      ]);

      expect(result.routesUpdated).toEqual([]);
    });

    it('classifies known route registry filenames as route files', async () => {
      const integrator = new ProjectIntegrator(root);

      const result = await integrator.integrateGeneratedFiles([
        { filePath: 'lib/app_routes.dart', content: 'final routes = {};' },
      ]);

      expect(result.routesUpdated).toEqual(['lib/app_routes.dart']);
    });

    it('classifies any file under a routes/ directory as a route file', async () => {
      const integrator = new ProjectIntegrator(root);

      const result = await integrator.integrateGeneratedFiles([
        { filePath: 'lib/routes/custom_routes.dart', content: 'final routes = {};' },
      ]);

      expect(result.routesUpdated).toEqual(['lib/routes/custom_routes.dart']);
    });
  });

  describe('updateAssets', () => {
    it('appends a new asset at the end of the assets section, not the start (previously inserted at the section start)', async () => {
      fs.writeFileSync(
        path.join(root, 'pubspec.yaml'),
        [
          'name: demo',
          'flutter:',
          '  uses-material-design: true',
          '  assets:',
          '    - assets/images/logo.png',
          '    - assets/images/icon.png',
          '',
          '  fonts:',
          '    - family: Roboto',
          '      fonts:',
          '        - asset: fonts/Roboto-Regular.ttf',
          '',
        ].join('\n')
      );

      const integrator = new ProjectIntegrator(root);
      await integrator.updateAssets([{ path: 'assets/images/banner.png', type: 'image' }]);

      const content = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf-8');
      const assetsBlock = content.split('fonts:')[0];
      const assetLines = assetsBlock.split('\n').filter(l => l.includes('assets/images/'));

      expect(assetLines).toEqual([
        '    - assets/images/logo.png',
        '    - assets/images/icon.png',
        '    - assets/images/banner.png',
      ]);
      // Confirms it landed before "fonts:", not inside it
      expect(content.indexOf('assets/images/banner.png')).toBeLessThan(content.indexOf('fonts:'));
    });

    it('does not duplicate an asset that is already registered', async () => {
      fs.writeFileSync(
        path.join(root, 'pubspec.yaml'),
        ['name: demo', 'flutter:', '  assets:', '    - assets/images/logo.png', ''].join('\n')
      );

      const integrator = new ProjectIntegrator(root);
      await integrator.updateAssets([{ path: 'assets/images/logo.png', type: 'image' }]);

      const content = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf-8');
      expect(content.match(/assets\/images\/logo\.png/g)).toHaveLength(1);
    });

    it('preserves comments elsewhere in pubspec.yaml (surgical edit, not a full YAML re-dump)', async () => {
      fs.writeFileSync(
        path.join(root, 'pubspec.yaml'),
        ['name: demo', '# a helpful comment', 'flutter:', '  assets:', '    - assets/images/logo.png', ''].join('\n')
      );

      const integrator = new ProjectIntegrator(root);
      await integrator.updateAssets([{ path: 'assets/images/banner.png', type: 'image' }]);

      const content = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf-8');
      expect(content).toContain('# a helpful comment');
    });
  });

  describe('updateRouteRegistrations', () => {
    it('refuses to edit a go_router-based route file instead of corrupting it', async () => {
      const routeFile = 'lib/router.dart';
      fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
      fs.writeFileSync(
        path.join(root, routeFile),
        [
          "import 'package:go_router/go_router.dart';",
          '',
          'final router = GoRouter(routes: [',
          "  GoRoute(path: '/', builder: (context, state) => HomePage()),",
          ']);',
        ].join('\n')
      );

      const integrator = new ProjectIntegrator(root);

      await expect(
        integrator.updateRouteRegistrations(routeFile, [{ path: '/new', widgetName: 'NewPage' }])
      ).rejects.toThrow(/go_router/i);
    });

    it('inserts a new route into a MaterialApp-style routes map', async () => {
      const routeFile = 'lib/routes.dart';
      fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
      fs.writeFileSync(
        path.join(root, routeFile),
        [
          "import 'package:flutter/material.dart';",
          '',
          'Map<String, WidgetBuilder> buildRoutes() {',
          '  return {',
          "    '/': (_) => HomePage(),",
          '  };',
          '}',
        ].join('\n')
      );

      const integrator = new ProjectIntegrator(root);
      await integrator.updateRouteRegistrations(routeFile, [{ path: '/new', widgetName: 'NewPage' }]);

      const content = fs.readFileSync(path.join(root, routeFile), 'utf-8');
      expect(content).toContain("'/new': (_) => NewPage(),");
    });
  });
});
