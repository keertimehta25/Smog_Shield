import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const IMPORT = /(?:from|import)\s+['"](\.{1,2}\/[^'"]*)['"]/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.|fixtures\.ts|e2e\.ts/.test(entry.name) ? [path] : [];
  });
}

/** The top-level area a file belongs to: shared, server or client. */
const area = (path: string) => relative(ROOT, path).split(sep)[0]!;

/** Every relative import of a source file, resolved to the area it points into. */
function importedAreas(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(IMPORT)].map((m) => area(join(file, '..', m[1]!)));
}

const RULES: Record<string, string[]> = {
  shared: ['shared'],
  server: ['server', 'shared'],
  client: ['client', 'shared'],
};

describe('architecture layers', () => {
  const files = ['shared', 'server', 'client'].flatMap((dir) => sources(join(ROOT, dir)));

  it('finds the source files it is meant to check', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(Object.keys(RULES))('%s code only imports from %s areas it is allowed to use', (name) => {
    const violations = files
      .filter((file) => area(file) === name)
      .flatMap((file) =>
        importedAreas(file)
          .filter((target) => !RULES[name]!.includes(target))
          .map((target) => `${relative(ROOT, file)} imports ${target}`),
      );
    expect(violations).toEqual([]);
  });
});
