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

`npm run mutation:check` runs the complete TypeScript scope from `stryker.config.json` with `--force`, so CI does not accept a cached incremental score. Use `npm run mutation:check:incremental` during iteration and `npm run mutation:check:labels` for a fast focused check. CI runs the complete scope with a 30-minute job timeout.

The initial full baseline after adding direct domain tests is **93.40%** (481 killed, 32 survived, 2 no-coverage, 274 compile errors; compile errors are excluded from the score). Per-file scores: backup 92.19%, metadata 92.69%, labels 85.00%, platforms 100%, discovery 100%, trash 100%. The 90% break threshold is 3.4 percentage points below the aggregate baseline, allowing a small amount of normal test evolution while preventing material regressions; it also remains above the lowest per-file score.

All 274 checker errors are TypeScript compile failures caused by generated mutants, not failures in the unmutated project. They arise when mutations remove type guards, alter literal/object types, or change nullability and consequently make production code or its typed tests invalid. The unmutated `npm run build` and test dry run pass. The two no-coverage mutants replace defensive fallback values that are unreachable for these APIs: the HTML attribute regex always supplies a capture for each match, and `String.prototype.split` always returns at least one item.

## Desktop packages

Linux builds and uploads a `.deb`. Windows builds and uploads an NSIS `.exe` from the `windows-latest` runner. A successful build proves packaging, not installed-app behavior; runtime smoke coverage is tracked separately.

## CI

`.github/workflows/ci.yml` runs frontend tests/build/format, full and production dependency audits, Rust tests/formatting, Linux packaging, Windows packaging, and the full mutation job. Push the integration branch or open a pull request to execute it; local results do not replace the Windows runner.
