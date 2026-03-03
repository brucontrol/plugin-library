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
const pluginsDir = join(root, 'widgets');
const distDir = join(root, 'dist', 'manifests');

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
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

async function main() {
  await mkdir(distDir, { recursive: true });

  const folders = await readdir(pluginsDir, { withFileTypes: true });
  const pluginDirs = folders.filter(d => d.isDirectory()).map(d => d.name);
  let count = 0;

  for (const folder of pluginDirs) {
    const yamlPath = join(pluginsDir, folder, 'widget.yaml');
    if (!existsSync(yamlPath)) {
      console.warn(`Skipping ${folder}: no widget.yaml`);
      continue;
    }

    const yamlContent = await readFile(yamlPath, 'utf8');
    const manifest = parseYaml(yamlContent);

    if (!manifest.name) {
      console.error(`${folder}/widget.yaml: missing 'name'`);
      process.exit(1);
    }

    const id = v5(normalizeName(manifest.name), NAMESPACE);

    let version = manifest.version || '1.0.0';
    const pkgPath = join(pluginsDir, folder, 'package.json');
    if (!manifest.version && existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
        if (pkg.version) version = pkg.version;
      } catch { /* ignore */ }
    }

    const widgetPath = `widgets/${folder}`;
    const commitHash = getLastCommitForPath(widgetPath);

    const registryManifest = {
      id,
      name: manifest.name,
      author: AUTHOR,
      description: manifest.description || '',
      repo: REPO,
      path: widgetPath,
      version,
      commitHash,
      official: true,
      beta: manifest.beta === true,
      tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    };

    const outPath = join(distDir, `${id}.json`);
    await writeFile(outPath, JSON.stringify(registryManifest, null, 2) + '\n', 'utf8');
    console.log(`  ${folder} → ${id}.json (v${version}${registryManifest.beta ? ' BETA' : ''})`);
    count++;
  }

  console.log(`\nGenerated ${count} manifests in dist/manifests/`);
}

main().catch(e => { console.error(e); process.exit(1); });
