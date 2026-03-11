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
| `style.css`   | Styles                         |
| `index.js`    | Logic and SDK integration      |

Optional: `ui-controls.json` (editor controls), `package.json` (CDN dependencies).

## element-template.yaml essentials

```yaml
name: Timer - Card
supportedTypes:
  - timer
defaultFor: timer
```

Also commonly used: `description`, `version`, `id`.

## Full documentation

For full reference (data model, SDK, editor, registry, scripts), see the [Element Template System Documentation](../app/docs/element-template-system/00-Overview-and-Quick-Reference.md) in the BruControl app repository.
