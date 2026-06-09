# Contributing to Wapp

First off — thanks for your interest in contributing! Every contribution, no matter how small, helps make Wapp better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this standard.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
- Check the [existing issues](https://github.com/jvondev/wapp/issues) to make sure the bug hasn't been reported already.
- Gather as much context as possible — OS, Tauri version, steps to reproduce.

### Suggesting Features

- Search existing feature requests first.
- Open a new issue with a clear title and description of the proposed enhancement.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. Install dependencies: `npm install`.
3. Make your changes and ensure `npm run lint` passes.
4. For Rust changes, run `cargo check` in `src-tauri`.
5. Commit with a clear message using [Conventional Commits](https://www.conventionalcommits.org/) format (e.g. `feat: add dark mode toggle`).
6. Push to your fork and open a PR.

## Project Structure

```
├── src/                    # SolidJS frontend
│   ├── components/        # Reusable UI components
│   ├── services/          # Tauri API wrappers
│   ├── store/             # SolidJS store (state management)
│   ├── styles/            # Global CSS (CSS variables, layout, components)
│   └── types/             # TypeScript type definitions
├── src-tauri/             # Rust backend (Tauri)
│   ├── src/
│   │   ├── commands/      # Tauri invoke commands
│   │   ├── lib.rs         # App setup & tray icon
│   │   ├── main.rs        # Entry point
│   │   ├── models.rs      # Shared structs
│   │   └── utils.rs       # Helper functions
│   └── Cargo.toml         # Rust dependencies
├── wapp-base/             # Minimal base engine (compiled to native binary)
├── scripts/               # Build/dev helper scripts
└── .github/workflows/     # CI/CD pipelines
```

## Development

```bash
# Dev mode (uses pre-built base binary)
npm run dev

# Dev mode with local base binary rebuild
npm run dev:local

# Production build
npm run build
```

## License

By contributing, you agree that your contributions will be licensed under the [Apache-2.0](LICENSE) license.
