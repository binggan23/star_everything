# 开发验证

## 快速检查

```sh
npm ci
npm test
npm run build
npm run format:check
npm run audit:full
npm run audit:production
source "$HOME/.cargo/env" 2>/dev/null || true
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

## Mutation

`npm run mutation:check` runs the complete TypeScript scope from `stryker.config.json`. Use `npm run mutation:check:incremental` during iteration and `npm run mutation:check:labels` for a fast focused check. CI runs the complete scope with a 30-minute job timeout; the current score is a baseline, not a release threshold.

## Desktop packages

Linux builds and uploads a `.deb`. Windows builds and uploads an NSIS `.exe` from the `windows-latest` runner. A successful build proves packaging, not installed-app behavior; runtime smoke coverage is tracked separately.

## CI

`.github/workflows/ci.yml` runs frontend tests/build/format, full and production dependency audits, Rust tests/formatting, Linux packaging, Windows packaging, and the full mutation job. Push the integration branch or open a pull request to execute it; local results do not replace the Windows runner.
