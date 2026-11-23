## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `binggan23/star_everything`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label strings equal to their names: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Product requirements
- `docs/srs.md` is the canonical V1 Software Requirements Specification. Every new agent session must read it before starting project work; use it as the source of truth for product scope and acceptance criteria, and surface conflicts instead of silently changing scope.

### Domain docs

Single-context: one `GLOSSARY.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## 前端规范
- Do not put business rules or useless UX copy on the page. Show only what helps users complete the task, understand the data, or decide the next step. Express business rules through control constraints, field validation, pre-submit confirmation, and failure feedback—not persistent explanatory text in pages, panels, forms, or modals. Remove duplicate titles, redundant buttons, implementation details, API constraints, and unhelpful explanations.
- 当出现以下情况:
    - 执行任何HTML/CSS/客户端JavaScript任务时
    - 涉及UI或功能领域如:UI/布局、性能与可访问性、现代浏览器API、安全与数据、国际化时
    务必调用modern-web-guidance skills
- 进行UI质量提升，审查、排版、布局、动效和可访问性等任务，原型制作时务必调用/impeccable这个插件(Extensions),若用户没有本插件则调用impeccable skills
