#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;
const tscCommand = resolve(REPOSITORY_ROOT, 'node_modules/typescript/bin/tsc');
const PACKAGE_ROOT = resolve(REPOSITORY_ROOT, 'packages/api-client');

const run = (command, arguments_, label) => {
  const result = spawnSync(command, arguments_, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
};

const verifyPackageContents = () => {
  const packageManifest = JSON.parse(
    readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'),
  );
  if (
    !Array.isArray(packageManifest.files) ||
    packageManifest.files.length !== 1 ||
    packageManifest.files[0] !== 'dist'
  ) {
    throw new Error(
      'API client package files allowlist must be exactly ["dist"]',
    );
  }

  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  const distFiles = walk(resolve(PACKAGE_ROOT, 'dist')).map((path) =>
    relative(PACKAGE_ROOT, path).replaceAll('\\', '/'),
  );
  const allowedDistSuffixes = ['.js', '.js.map', '.d.ts', '.d.ts.map'];
  const unexpectedFiles = distFiles.filter(
    (path) => !allowedDistSuffixes.some((suffix) => path.endsWith(suffix)),
  );
  const requiredFiles = ['dist/index.js', 'dist/index.d.ts'];
  const missingFiles = requiredFiles.filter(
    (path) => !distFiles.includes(path),
  );

  // npm always includes selected metadata even when `files` is restrictive.
  // Fail if a new auto-included root document appears without review.
  const allowedMetadata = new Set(['README.md', 'package.json']);
  const automaticMetadataPattern =
    /^(readme|license|licence|copying|changelog|history|notice)(\..*)?$/i;
  const unexpectedMetadata = readdirSync(PACKAGE_ROOT, {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isFile() &&
        automaticMetadataPattern.test(entry.name) &&
        !allowedMetadata.has(entry.name),
    )
    .map((entry) => entry.name);

  if (
    unexpectedFiles.length > 0 ||
    missingFiles.length > 0 ||
    unexpectedMetadata.length > 0
  ) {
    throw new Error(
      [
        unexpectedFiles.length > 0
          ? `unexpected dist files: ${unexpectedFiles.join(', ')}`
          : undefined,
        missingFiles.length > 0
          ? `missing package files: ${missingFiles.join(', ')}`
          : undefined,
        unexpectedMetadata.length > 0
          ? `unreviewed automatic package metadata: ${unexpectedMetadata.join(', ')}`
          : undefined,
      ]
        .filter(Boolean)
        .join('; '),
    );
  }

  console.log(
    `API client package allowlist passed (${distFiles.length} dist artifacts).`,
  );
};

run(
  nodeCommand,
  ['scripts/api-client/generate-api-client.mjs', '--check'],
  'generated client drift check',
);
run(
  npmCommand,
  ['run', 'build', '--workspace', '@ohealth/api-client'],
  'strict client build',
);
run(
  nodeCommand,
  ['--test', 'packages/api-client/test/runtime/client.test.mjs'],
  'client runtime tests',
);

for (const fixture of ['node', 'browser', 'react-native']) {
  run(
    nodeCommand,
    [
      tscCommand,
      '--project',
      `packages/api-client/test/fixtures/${fixture}/tsconfig.json`,
    ],
    `${fixture} compile fixture`,
  );
}

verifyPackageContents();

console.log('API client verification passed.');
