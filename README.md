# BruControl Plugin Library

This repository is the source of BruControl element template plugins—reusable UI components for device elements on dashboards.

## Folder structure

Each element template lives in its own folder under `element-templates/`:

```
element-templates/
  timer/
  button/
  gv-value/
  chart/
  ...
```

## Required files

| File                   | Purpose                         |
|------------------------|---------------------------------|
| `element-template.yaml` | Manifest: name, types, defaults |
| `index.html`           | Element template                |
| `style.css`            | Styles                          |
| `index.js`             | Logic and SDK integration      |

Optional: `ui-controls.json` (editor controls), `package.json` (CDN dependencies).

## element-template.yaml essentials

```yaml
name: Timer - Card
supportedTypes:
  - timer
defaultFor: timer
```

Also commonly used: `description`, `version`, `id`.

---

## Beta workflow

The repo uses a **main** and **beta** branch model for releasing stable vs. pre-release plugins.

### Branches

| Branch | Purpose |
|--------|---------|
| **main** | Stable releases. Pushes sync to [brucontrol-releases](https://github.com/brucontrol/brucontrol-releases) as official plugins. |
| **beta** | Pre-release testing. Pushes create *beta* manifests (e.g. `uuid-beta.json`) alongside stable in the registry. |

### Workflow

1. **Develop on beta** – Push changes to `beta`. The CI:
   - Bumps versions for changed templates
   - Generates beta manifests for changed templates only
   - Syncs `*-beta.json` to brucontrol-releases
   - Users see "Int Debug (beta)" in the Plugin Store with an "Install Beta" button

2. **Promote to stable** – Merge `beta` into `main`. The CI:
   - Bumps versions and clears `beta: true` (CLEAR_BETA)
   - Generates stable manifests
   - Syncs to brucontrol-releases, **removing** the `*-beta.json` for promoted plugins
   - Backmerges `main` into `beta` to keep branches in sync

3. **element-template.yaml** – The `beta` field is managed by CI:
   - On beta branch: CI sets `beta: true` for changed templates
   - On main (after merge): CI sets `beta: false`
   - Do not manually add `beta: true`; the workflow handles it

### Version bumping

CI automatically bumps the **patch** version (e.g. 1.0.7 → 1.0.8) for templates that change in a push. Only templates with changes outside `element-template.yaml` are bumped (so prior CI commits don’t trigger re-bumps).

---

## Full documentation

For full reference (data model, SDK, editor, registry, scripts), see the [Element Template System Documentation](../app/docs/element-template-system/00-Overview-and-Quick-Reference.md) in the BruControl app repository.
