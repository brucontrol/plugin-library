#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { v5 } from 'uuid';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const colorThemesDir = join(root, 'color-themes');
const distDir = join(root, 'dist', 'manifests', 'color-themes');

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c9';
const REPO = process.env.PLUGIN_REPO || 'brucontrol/plugin-library';
const AUTHOR = process.env.PLUGIN_AUTHOR || 'BruControl';
const HEAD_HASH = process.env.COMMIT_HASH
  || execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

/** Get the last commit that touched the given path. Falls back to HEAD if path has no history. */
function getLastCommitForPath(path) {
  try {
    const hash = execSync(`git log -1 --format=%H -- "${path}"`, { cwd: root, encoding: 'utf8' }).trim();
    return hash || HEAD_HASH;
  } catch {
    return HEAD_HASH;
  }
}

function normalizeName(name) {
  if (typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

const COLOR_FIELDS = [
  'bgPrimary', 'bgSecondary', 'bgTertiary', 'bgHover', 'bgActive', 'bgSelection',
  'textPrimary', 'textSecondary', 'textMuted',
  'borderColor', 'borderSubtle', 'borderFocus',
  'accentPrimary', 'accentHover', 'accentBlue', 'accentGreen', 'accentYellow',
  'accentOrange', 'accentPurple', 'accentRed',
  'scrollbarBg', 'scrollbarThumb', 'scrollbarThumbHover',
  'listActiveBackground', 'listActiveHoverBackground',
  'editorLineHighlight', 'editorLineNumber', 'editorLineNumberActive', 'editorCursor',
  'editorExecutionLineRunning', 'editorExecutionLinePaused',
  'editorExecutionGlyphRunning', 'editorExecutionGlyphPaused',
  'editorComment', 'editorString', 'editorKeyword', 'editorType', 'editorFunction', 'editorOperator',
  'inputBackground', 'inputForeground', 'inputBorder',
];

async function main() {
  await mkdir(distDir, { recursive: true });

  const folders = await readdir(colorThemesDir, { withFileTypes: true });
  const themeDirs = folders.filter(d => d.isDirectory()).map(d => d.name);
  let count = 0;

  for (const folder of themeDirs) {
    const yamlPath = join(colorThemesDir, folder, 'color-theme.yaml');
    if (!existsSync(yamlPath)) {
      console.warn(`Skipping ${folder}: no color-theme.yaml`);
      continue;
    }

    const yamlContent = await readFile(yamlPath, 'utf8');
    const manifest = parseYaml(yamlContent);

    if (!manifest.name) {
      console.error(`${folder}/color-theme.yaml: missing 'name'`);
      process.exit(1);
    }

    const id = v5(normalizeName(manifest.name), NAMESPACE);
    const version = manifest.version || '1.0.0';

    const colors = {};
    for (const field of COLOR_FIELDS) {
      if (manifest[field] != null) colors[field] = manifest[field];
    }

    const themePath = `color-themes/${folder}`;
    const commitHash = getLastCommitForPath(themePath);

    const registryManifest = {
      id,
      name: manifest.name,
      author: AUTHOR,
      description: manifest.description || '',
      repo: REPO,
      path: themePath,
      version,
      commitHash,
      official: true,
      beta: manifest.beta === true,
      tags: Array.isArray(manifest.tags) ? manifest.tags : [],
      ...colors,
    };

    const outPath = join(distDir, `${id}.json`);
    await writeFile(outPath, JSON.stringify(registryManifest, null, 2) + '\n', 'utf8');
    console.log(`  ${folder} → ${id}.json (v${version})`);
    count++;
  }

  console.log(`\nGenerated ${count} color theme manifests in dist/manifests/color-themes/`);
}

main().catch(e => { console.error(e); process.exit(1); });
