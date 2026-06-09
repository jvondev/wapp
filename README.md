# Wapp — Turn Any Web App Into a Desktop App

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-333333.svg)](https://tauri.app)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.x-2c4f7c.svg)](https://solidjs.com)
[![Rust](https://img.shields.io/badge/Rust-2021-orange.svg)](https://www.rust-lang.org)

**Wapp** lets anyone — from solo developers to enterprise teams — convert web apps, dashboards, and web tools into native cross-platform desktop applications in seconds. Just 3mb lightweight native performance.

---

## Why Wapp?

Most internal tools, admin panels, SaaS dashboards, and even popular web apps are stuck inside your browser. tabs clutter, offline access is impossible, and "Add to Home Screen" just doesn't cut it.

Wapp solves this. It wraps any web URL into a standalone macOS, Windows, or Linux desktop app — with a custom icon, own window styling, and native feel — all while staying under **10 MB**.

| Feature | Wapp | Electron | PWA |
|---------|------|----------|-----|
| **Binary size** | < 5 MB | 100–150 MB | N/A |
| **Memory usage** | ~50–100 MB | 300 MB+ | Browser tab |
| **Offline support** | Yes | Yes | Limited |
| **Custom tray/menu** | Yes | Yes | No |
| **Native alerts** | Yes | Yes | No |
| **Cross-platform** | Win/Mac/Linux | Win/Mac/Linux | Browser |

---

## Core Strengths

- **Ultra Lightweight**: Native Rust engine, not Chromium. Installers are tiny.
- **Zero-Bloat Builds**: Strip everything unused. Your app, not a browser.
- **Native OS Integration**: System tray, menu bar, window decorations, file associations.
- **Built for Teams**: Create multiple branded app instances from the same dashboard.
- **Dark Mode UI**: Beautiful, polished interface with your choice of theme.
- **One-Click Build**: Select OS target, click, done. Outputs `.exe`, `.app`, or `.AppImage`.

---

## Who Is It For?

- **Dev Teams**: Ship your internal tools (admin panels, dashboards) as standalone apps.
- **Small Businesses**: Turn WordPress, Shopify, or any SaaS dashboard into a desktop shortcut your team actually uses.
- **Power Users**: Package Notion, Linear, or any web workspace as a dedicated app — no browser tab confusion.
- **Agencies**: Deliver polished desktop wrappers to clients with custom branding.

---

## Screenshots

![Wapp Dashboard](https://via.placeholder.com/1200x600/18181b/fafafa?text=Wapp+Dashboard+-+App+Library)

*App library with live build progress and native tray icon.*

![Command Center](https://via.placeholder.com/1200x500/18181b/fafafa?text=Command+Center+-+Ctrl%2BK+to+open)

*Quick search + instant preview of any web app before building.*

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Rust** ≥ 1.75 (only needed for local base engine builds — see below)

### Installation

```bash
git clone https://github.com/jvondev/wapp.git
cd wapp
npm install
npm run dev
```

### Build Your First App

1. Press **⌘K / Ctrl+K** (or click **New Wapp**).
2. Paste any URL — e.g. `https://wordpress.com` or your internal dashboard.
3. Configure: icon, window size, frameless mode, target OS.
4. Hit **Create Wapp** — your native app is ready in seconds.

### Using a Local Base Engine (Optional)

The default mode downloads the pre-built base engine from npm. To compile it locally:

```bash
npm run dev:local
```

This rebuilds `wapp-base` from Rust source and hot-reloads on changes.

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                       Wapp (Tauri v2)                  │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │   SolidJS UI     │    │   Rust Backend            │  │
│  │  (Frontend)      │◄──►│   commands/ (invoke API)  │  │
│  │  - Store (state) │    │   - wapp (CRUD + build)   │  │
│  │  - Components    │    │   - preview (webview)     │  │
│  │  - CSS (theming) │    │   - metadata (scraper)    │  │
│  └─────────────────┘    └───────────────────────────┘  │
│         ▲                        ▲                     │
│         │                        │                     │
│  ┌──────┴────────┐     ┌────────┴────────────┐        │
│  │ @jvondev/     │     │  Generated Output    │        │
│  │ wapp-base     │     │  .exe / .app / .deb  │        │
│  │ (minimal Rust)│     │                      │        │
│  └───────────────┘     └──────────────────────┘        │
└───────────────────────────────────────────────────────┘
```

**wapp-base** is a stripped-down Rust binary that loads a runtime config file (`wapp.config.json`) and opens the target URL in a native window. Think of it as the compiled engine — the Wapp UI is the builder/manager that generates these configs and signs off the binaries.

---

## Performance

Built with performance as a first-class citizen:

| Metric | Value |
|--------|-------|
| Engine size | < 3 MB |
| Full installer (Win exe) | ~8–10 MB |
| Cold start time | < 1 second |
| RAM (idle webview) | 50–80 MB |
| RAM (loaded page) | 100–200 MB |

Optimizations applied:
- `opt-level = "s"` — size optimization
- `lto = true` — Link-Time Optimization
- `strip = true` — strip debug symbols
- `panic = "abort"` — smaller panic handling
- `reqwest` with rustls (no OpenSSL)
- Image processing only when icons are uploaded

---

## Customization

You can shape your generated apps however you want:

- **Window**: Fixed or resizable, frameless, start maximized
- **Icon**: Upload custom PNG or auto-fetch from favicon
- **Category**: Organize into Work, Enterprise, or custom tags
- **Theme**: Dark or light for the Wapp manager itself
- **OS Target**: Build for Windows, macOS, or Linux separately

---

## Roadmap

- [ ] Auto-update support for generated apps
- [ ] Plugin system (auth middleware, request interceptors)
- [ ] Sidecar binaries (CLI tools bundled with apps)
- [ ] Multi-monitor launch positioning
- [ ] App signing / notarization automation
- [ ] Packaged app store (community templates)
- [ ] Progress indicators with real-time logs

---

## FAQ

**Does Wapp use Electron?**
No. Wapp uses [Tauri v2](https://tauri.app) with system WebView — on Windows it's WebView2, on macOS it's WebKit, on Linux it's WebKitGTK. This is the primary reason for the tiny size.

**Can I use this for my company's internal tools?**
Absolutely. Wapp is licensed under Apache-2.0 — free for commercial use.

**What websites can Wapp wrap?**
Any site that works in a modern browser. Some sites with heavy anti-bot or strict CSP may require extra configuration.

**Does it work offline?**
The *generated apps* can work offline if the wrapped web app supports it. The Wapp *builder* requires internet for initial npm install and fetching favicons.

**How do I update the base engine?**
Run `npm update @jvondev/wapp-base`. For local builds, run `npm run dev:local`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | [SolidJS](https://solidjs.com) + TypeScript + Vite |
| Backend | Rust + [Tauri v2](https://tauri.app) |
| Engine | wapp-base (minimal Rust binary) |
| Styling | CSS Variables (custom property system) |
| Icons | [Lucide](https://lucide.dev) |
| CI/CD | GitHub Actions |
| License | Apache-2.0 |

---

## Contributing

We welcome contributions of every kind! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Star History

If this project helped you, consider giving it a star ⭐ — it motivates us to keep building.

---

## License

Wapp is open source under the [Apache License 2.0](LICENSE).

```
Copyright 2025 jvondev

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
