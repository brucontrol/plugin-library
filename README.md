# BruControl Plugin Library

## About this repo

This repository contains the **default plugins for BruControl** — the official widget and card plugins that ship with and extend the BruControl brewing control platform. These plugins are **open source** and available under the project's license.

BruControl uses a plugin architecture for its dashboard UI. Each plugin in this library provides a reusable widget type (e.g., Digital Output, PID, Chart, Timer) that users can add to their control panels. This repo is the canonical source for these default plugins.

## Structure

- `plugins/` — Source code for each plugin (HTML, CSS, JS, `widget.yaml`, `ui-controls.json`, etc.)
- `dist/manifests/` — Generated plugin manifests used by the registry
- `scripts/` — Build and validation tooling

## Contributing

Contributions are welcome. If you'd like to add a new plugin, improve an existing one, or fix a bug, please open a pull request. Plugin changes are validated and synced to the [brucontrol-releases](https://github.com/brucontrol/brucontrol-releases) registry via the GitHub Action.

## License

These plugins are open source. See the repository's license file for details.
