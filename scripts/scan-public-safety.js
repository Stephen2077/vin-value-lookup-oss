#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const forbiddenContentTerms = [
  chars([77, 97, 110, 104, 101, 105, 109]),
  chars([77, 77, 82]),
  chars([26364, 28023]),
  'credentials.env',
  'admin.env'
];
const forbiddenPathTerms = [
  'browser_profiles',
  'playwright-profile',
  'chrome-profile',
  'screenshots',
  'backups',
  'docs/handoff',
  chars([21069, 31471, 72, 84, 77, 76, 29256, 26412, 22791, 20221])
];
const skippedDirs = new Set(['.git', 'node_modules']);
const skippedFiles = new Set(['scripts/scan-public-safety.js']);
const findings = [];

for (const file of await listFiles(root)) {
  const relativePath = file.slice(root.length).replace(/^\/+/, '');
  if (skippedFiles.has(relativePath)) continue;
  const content = await readFile(file, 'utf8').catch(() => null);
  if (content === null) continue;

  for (const term of forbiddenContentTerms) {
    if (content.toLowerCase().includes(term.toLowerCase())) {
      findings.push(`${relativePath}: contains ${term}`);
    }
  }
  for (const term of forbiddenPathTerms) {
    if (relativePath.toLowerCase().includes(term.toLowerCase())) {
      findings.push(`${relativePath}: path contains ${term}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Public safety scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Public safety scan passed.');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (skippedDirs.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function chars(codePoints) {
  return String.fromCodePoint(...codePoints);
}
