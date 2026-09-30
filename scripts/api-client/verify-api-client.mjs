#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;
const tscCommand = resolve(REPOSITORY_ROOT, 'node_modules/typescript/bin/tsc');

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

console.log('API client verification passed.');
