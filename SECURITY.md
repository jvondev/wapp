# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it **privately** via email to **jvon.dev@gmail.com**.

Please **do not** open a public issue for security vulnerabilities.

We will:
1. Acknowledge receipt of your report within 48 hours.
2. Provide an estimated timeline for a fix.
3. Credit you in the release notes (unless you prefer to remain anonymous).

## Security Best Practices for Self-Hosting

If you deploy Wapp in an enterprise environment:

- Always review the CSP in `tauri.conf.json` before deploying.
- Never embed production secrets, API keys, or credentials in the built config.
- Keep the Rust toolchain updated (`rustup update`).
- Audit downloaded base binaries against the published checksums.
- The `deps` command setup can install software system-wide — restrict access appropriately.
