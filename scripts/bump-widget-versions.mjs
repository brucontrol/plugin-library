#!/usr/bin/env node
/**
 * Bump version in widget.yaml for widgets that have changes in the given commit range.
 * Used by CI so authors don't need to manually increment versions on every edit.
 *
 * Env:
 *   BEFORE_SHA - start of range (e.g. github.event.before for push)
 *   AFTER_SHA  - end of range (e.g. github.sha for push)
 *   If unset (e.g. workflow_dispatch), uses HEAD~1..HEAD.
 */
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pluginsDir = join(root, 'widgets');

/** Bump patch version (e.g. 1.0.4 -> 1.0.5). Defaults to 1.0.1 if unparseable. */
function bumpPatch(version) {
  if (!version || typeof version !== 'string') return '1.0.1';
  const m = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-[\w.]+)?(?:\+[\w.]+)?$/);
  if (!m) return '1.0.1';
  const patch = parseInt(m[3], 10) + 1;
  return `${m[1]}.${m[2]}.${patch}`;
}

/**
 * Get widget folder names that had changes in the given commit range.
 * Only includes widgets with changes outside widget.yaml (to avoid re-bumping when
 * the prior run committed a version bump).
 */
function getChangedWidgetFolders(beforeSha, afterSha) {
  const empty = '0000000000000000000000000000000000000000';
  if (beforeSha === empty || !beforeSha) {
    return [];
  }
  try {
    const out = execSync(
      `git diff --name-only "${beforeSha}" "${afterSha}" -- widgets/`,
      { cwd: root, encoding: 'utf8' }
    ).trim();
    if (!out) return [];
    const folders = new Set();
    for (const line of out.split('\n').filter(Boolean)) {
      const m = line.match(/^widgets\/([^/]+)\/(.+)$/);
      if (m) {
        const [, folder, file] = m;
        if (file !== 'widget.yaml') {
          folders.add(folder);
        }
      }
    }
    return [...folders];
  } catch {
    return [];
  }
}

async function main() {
  const beforeSha = process.env.BEFORE_SHA || 'HEAD~1';
  const afterSha = process.env.AFTER_SHA || 'HEAD';

  const folders = getChangedWidgetFolders(beforeSha, afterSha);
  if (folders.length === 0) {
    console.log('No widget folders changed in this push; skipping version bumps.');
    return;
  }

  let count = 0;
  for (const folder of folders.sort()) {
    const yamlPath = join(pluginsDir, folder, 'widget.yaml');
    if (!existsSync(yamlPath)) {
      console.warn(`Skipping ${folder}: no widget.yaml`);
      continue;
    }

    const yamlContent = await readFile(yamlPath, 'utf8');
    const manifest = parseYaml(yamlContent);
    const oldVersion = manifest.version || '1.0.0';
    const newVersion = bumpPatch(oldVersion);
    manifest.version = newVersion;
    const updated = stringifyYaml(manifest, { lineWidth: -1 });
    await writeFile(yamlPath, updated, 'utf8');
    console.log(`  ${folder}: ${oldVersion} → ${newVersion}`);
    count++;
  }

  console.log(`\nBumped version for ${count} widget(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
