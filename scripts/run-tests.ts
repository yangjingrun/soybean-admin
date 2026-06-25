#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type TestGroup = {
  root: string;
  tsconfig?: string;
};

type TestGroupName = 'front' | 'server';

const testGroups: Record<TestGroupName, TestGroup> = {
  front: {
    root: 'src'
  },
  server: {
    root: 'apps/server/src',
    tsconfig: 'apps/server/tsconfig.json'
  }
};

/** Finds TypeScript node:test specs under a root directory in stable order. */
export function findSpecFiles(root: string): string[] {
  const absoluteRoot = resolve(root);
  const files: string[] = [];

  walk(absoluteRoot, files);

  return files.sort();
}

/** Builds the tsx arguments for one test group. */
export function buildTsxTestArgs(files: string[], tsconfig?: string): string[] {
  return [...(tsconfig ? ['--tsconfig', tsconfig] : []), '--test', ...files];
}

function walk(directory: string, files: string[]) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      walk(path, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      files.push(path);
    }
  }
}

function runGroup(groupName: TestGroupName) {
  const group = testGroups[groupName];

  if (!group) {
    throw new Error(`Unknown test group: ${groupName}`);
  }

  const files = findSpecFiles(group.root);

  if (!files.length) {
    console.log(`No ${groupName} spec files found under ${group.root}`);
    return 0;
  }

  const result = spawnSync('pnpm', ['exec', 'tsx', ...buildTsxTestArgs(files, group.tsconfig)], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  return result.status ?? 1;
}

function main() {
  const mode = process.argv[2] || 'all';
  const groups = mode === 'all' ? (Object.keys(testGroups) as TestGroupName[]) : [mode as TestGroupName];

  for (const group of groups) {
    const status = runGroup(group);

    if (status !== 0) {
      process.exit(status);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
