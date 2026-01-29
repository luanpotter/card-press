# card-press

[![CI](https://img.shields.io/github/actions/workflow/status/luanpotter/card-press/ci.yaml?logo=github&style=flat-square)](https://github.com/luanpotter/card-press/actions/workflows/ci.yaml)
[![Deployment](https://img.shields.io/badge/deployment-live-blue?style=flat-square)](https://luan.xyz/projects/card-press)
[![License](https://img.shields.io/github/license/luanpotter/card-press?style=flat-square)](./LICENSE)

<img src="./assets/screenshot.png" width="800" />

[Card Press](https://luan.xyz/projects/card-press) is a fully client-side webapp for generating print-then-cut PDFs for playing cards.

In particular, it provides a built-in template that works with the _Cricut Maker_ cutting machine (but it supports defining arbitrary templates as well).

Best suited for smaller print runs, as the PDF templates and card images are stored locally on IndexedDB and everything is processed client-side.

## Features

- Run it yourself or use our [GitHub Pages deployment](https://luan.xyz/projects/card-press), fully free and no fuss.
- Define your own template or use the built-in for simple 3x3 PDFs (A4 or Letter) or the custom _Cricut_ template.
- Store multiple sessions with different card sets and templates.
- Add cards using the multi-file picker, pasting from clipboard, or import from outside sources (note: the import feature will connect to an external website).
- Optional support for a card-backs PDF.
- All data is stored locally on your LocalStorage and IndexedDB; no server connection. Your files are never uploaded to the internet.

> [!NOTE]
> I'm still refining the Cricut template and workflow. I will be posting more detailed instructions on that part once I have it settled.

## Development

Contributions are more than welcome! Send issues, pull requests, and give us a ⭐ if you find it useful.

To setup and run locally, use the provided scripts:

```bash
./scripts/setup.sh # optional; installs bun and linting tools
./scripts/build.sh # builds the project to a dist folder
./scripts/lint.sh [--fix] # lints the code, use --fix to auto-fix issues
```

To run locally, use the bun dev server:

```bash
bun run dev
```
