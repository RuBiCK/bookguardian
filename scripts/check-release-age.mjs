#!/usr/bin/env node
/**
 * Supply-chain guard: fail if any package pinned in pnpm-lock.yaml was
 * published less than MIN_AGE_DAYS ago.
 *
 * pnpm's `minimumReleaseAge` enforces this at resolution time; this script
 * re-verifies the committed lockfile independently (in CI and on demand), so a
 * lockfile edited by hand, by a bot, or with `minimumReleaseAgeExclude` cannot
 * slip a fresh release in unnoticed.
 *
 * Usage: node scripts/check-release-age.mjs [--days 7] [--lockfile pnpm-lock.yaml]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const MIN_AGE_DAYS = Number(opt('days', process.env.MIN_RELEASE_AGE_DAYS ?? '7'));
const LOCKFILE = resolve(opt('lockfile', 'pnpm-lock.yaml'));
const REGISTRY = (process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org').replace(
  /\/$/,
  '',
);
const CONCURRENCY = 16;

/** Extract `{ name, version }` for every entry in the lockfile's `packages:` section. */
export function parseLockfilePackages(text) {
  const out = [];
  let inPackages = false;
  for (const line of text.split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/.test(line)) break; // next top-level section
    if (!inPackages) continue;
    const m = /^ {2}'?((?:@[^/']+\/)?[^@'\s]+)@([^'(\s]+)(?:\([^)]*\))*'?:\s*$/.exec(line);
    if (m) out.push({ name: m[1], version: m[2] });
  }
  return out;
}

async function fetchPublishTime(name, version) {
  const url = `${REGISTRY}/${name.replace('/', '%2f')}`;
  // Abbreviated metadata carries `time` on registry.npmjs.org; fall back to full.
  for (const accept of ['application/vnd.npm.install-v1+json', 'application/json']) {
    const res = await fetch(url, { headers: { accept } });
    if (!res.ok) throw new Error(`${name}: registry responded ${res.status}`);
    const meta = await res.json();
    const time = meta.time?.[version];
    if (time) return new Date(time);
  }
  throw new Error(`${name}@${version}: no publish time in registry metadata`);
}

async function main() {
  const packages = parseLockfilePackages(readFileSync(LOCKFILE, 'utf8'));
  if (packages.length === 0) {
    console.error(`No packages found in ${LOCKFILE}`);
    process.exit(2);
  }
  const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
  const tooNew = [];
  const errors = [];
  let index = 0;

  async function worker() {
    while (index < packages.length) {
      const pkg = packages[index++];
      try {
        const published = await fetchPublishTime(pkg.name, pkg.version);
        if (published.getTime() > cutoff) tooNew.push({ ...pkg, published });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(
    `Checked ${packages.length} locked packages against a ${MIN_AGE_DAYS}-day minimum age.`,
  );
  for (const { name, version, published } of tooNew.sort((a, b) => b.published - a.published)) {
    const ageHours = Math.round((Date.now() - published.getTime()) / 36e5);
    console.log(
      `  TOO NEW  ${name}@${version}  published ${published.toISOString()} (${ageHours}h ago)`,
    );
  }
  for (const message of errors) console.log(`  ERROR    ${message}`);

  if (tooNew.length > 0 || errors.length > 0) {
    console.error(
      `\n${tooNew.length} package(s) violate the minimum release age; ${errors.length} lookup error(s).`,
    );
    process.exit(1);
  }
  console.log('OK — every locked package is old enough.');
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
