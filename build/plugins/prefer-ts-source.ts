import fs from 'node:fs';
import path from 'node:path';
import type { PluginOption } from 'vite';

const sourceRoots = ['src', 'build', 'packages'];

function stripQuery(id: string) {
  const [filepath, query = ''] = id.split('?');

  return { filepath, query };
}

function withQuery(filepath: string, query: string) {
  return query ? `${filepath}?${query}` : filepath;
}

function isManagedSource(filepath: string) {
  const relativePath = path.relative(process.cwd(), filepath);

  return sourceRoots.some(root => relativePath === root || relativePath.startsWith(`${root}${path.sep}`));
}

function getPreferredTsPath(jsPath: string) {
  if (!isManagedSource(jsPath)) {
    return null;
  }

  const tsPath = jsPath.replace(/\.js$/, '.ts');
  const tsxPath = jsPath.replace(/\.js$/, '.tsx');

  if (fs.existsSync(tsPath)) {
    return tsPath;
  }

  if (fs.existsSync(tsxPath)) {
    return tsxPath;
  }

  return null;
}

/**
 * Resolve dev-server JS module URLs back to TS sources when historical JS outputs exist beside them.
 */
export function setupPreferTsSourcePlugin(): PluginOption {
  return {
    name: 'soybean:prefer-ts-source',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        const { filepath, query } = stripQuery(decodeURI(url));

        if (!filepath.endsWith('.js')) {
          next();
          return;
        }

        const jsPath = path.resolve(process.cwd(), filepath.replace(/^\//, ''));
        const preferredPath = getPreferredTsPath(jsPath);

        if (preferredPath) {
          const relativePath = path.relative(process.cwd(), preferredPath).split(path.sep).join('/');

          req.url = withQuery(`/${relativePath}`, query);
        }

        next();
      });
    },
    resolveId(source, importer) {
      const { filepath, query } = stripQuery(source);

      if (!filepath.endsWith('.js')) {
        return null;
      }

      const importerPath = importer ? stripQuery(importer).filepath : '';
      const absoluteJsPath = filepath.startsWith('/')
        ? path.resolve(process.cwd(), filepath.slice(1))
        : path.resolve(importerPath ? path.dirname(importerPath) : process.cwd(), filepath);
      const preferredPath = getPreferredTsPath(absoluteJsPath);

      return preferredPath ? withQuery(preferredPath, query) : null;
    }
  };
}
