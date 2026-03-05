# BruControl Plugin Library

This repository is the source of BruControl widget plugins—reusable UI components for device elements on dashboards.

## Folder structure

Each widget lives in its own folder under `widgets/`:

```
widgets/
  timer/
  button/
  gv-value/
  chart/
  ...
```

## Required files

| File        | Purpose                         |
|-------------|---------------------------------|
| `widget.yaml` | Manifest: name, types, defaults |
| `index.html`  | Widget template                |
| `style.css`   | Styles                         |
| `index.js`    | Logic and SDK integration      |

Optional: `ui-controls.json` (editor controls), `package.json` (CDN dependencies).

## widget.yaml essentials

```yaml
name: Timer - Card
supportedTypes:
  - timer
defaultFor: timer
```

Also commonly used: `description`, `version`, `id`.

## Full documentation

For full reference (data model, SDK, editor, registry, scripts), see the [Widget System Documentation](../app/docs/widget-system/00-Overview-and-Quick-Reference.md) in the BruControl app repository.
