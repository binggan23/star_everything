# Star Everything Frontend Design

## Purpose

A desktop-first personal collection workspace for quickly finding, saving, and organizing URLs and authors. The UI is an operational tool, not a marketing surface. Preserve the product rules in `docs/srs.md`; this document specifies the front-end information architecture and interaction language.

## Platform and visual references

- Runtime: existing TypeScript, React 19, and Tauri 2 desktop application for Linux and Windows.
- Primary viewport: 1080 x 720. Minimum supported window: 720 x 520.
- Use the user's React Bits references: `Scanner-JS-CSS`, `CrystalizedBall-JS-CSS`, `CardSwap-JS-CSS`, `GooeyNav-JS-CSS`, and `SpecularButton-JS-CSS`, installed through their documented `npx shadcn@latest add @react-bits/...` commands when implementation begins.
- These references define interaction and effect primitives; adapt them to the existing app rather than changing the data layer or adding unrelated UI systems.

## Application flow

1. Every launch opens the entry screen: the CrystalizedBall over the Scanner background.
2. Activating the ball opens the CardSwap page selector. Selecting a card enters one of four workspace pages: Filter, Collections, Trash, or Settings.
3. The ball transitions into a vertical GooeyNav on the left side of the workspace. The navigation switches among the same four pages.
4. `Ctrl+K` opens the CardSwap selector as an overlay from any workspace page. Arrow keys move selection, Enter opens the selected page, and Escape closes the selector and returns focus to the previous page. Do not intercept the shortcut while the user is entering text in a form control.
5. The Scanner remains the application background across the entry screen, page selector, and workspace. Keep the foreground readable with an opaque/translucent surface treatment behind dense content. The full effect is enabled by default. An application setting switches to a reduced-motion version; that app preference controls the effect and is not automatically overridden by the operating-system preference.

## Workspace shell

- Left: persistent vertical four-page navigation; its active page is unambiguous and keyboard accessible.
- Main: page title and task controls, followed by the page's content. Main content scrolls independently from navigation.
- Scanner is a background layer only. It must not capture pointer input intended for controls.
- Use restrained surfaces, stable row dimensions, clear selected/focus states, compact data density, and small radii. Avoid promotional hero composition, decorative content cards, gradient decoration, and persistent explanatory copy.
- At narrow widths, keep all actions available without horizontal page overflow; navigation may collapse to an accessible drawer.

## Pages

### Filter

Purpose: search and filter all entries.

- Show result count, a search field, filter controls, and a primary Add Collection button.
- Render entries in a dense table with sortable columns for title/primary value, platform, author, content labels, folder path, and saved time. Preserve URLs and secondary values in the title/primary-value cell where needed. The default order remains newest first.
- Header controls expose sorting and relevant filters in an Excel-like menu. Platform, content-label, and folder filters use multi-selects. Preserve existing semantics: OR within a filter dimension and AND between dimensions; folder filtering includes descendants.
- Show active filters and provide a clear-all action. Empty, no-match, loading, failure, and long-content states must remain legible.
- Add Collection opens the shared create/edit dialog.

### Collections

Purpose: browse the folder hierarchy and the entries held in a selected folder.

- Show a folder tree and the selected folder's entries together in the same page.
- The tree supports expand/collapse, a distinct selected state, entry counts, and independent scrolling when long.
- Each folder exposes a context menu for creating a child folder, renaming, moving, and deleting. Preserve deletion impact confirmation and both existing deletion modes.
- Selecting a folder shows entries associated with that folder and all descendants. Support entries belonging to multiple folders.
- Reuse the Filter page's table and Add Collection dialog rather than creating a second implementation.

### Trash

Purpose: recover or permanently remove deleted entries and folder deletion groups.

- Show the retention state, remaining days, restore action, permanent-clear action, and clear-all action.
- Reuse the table and sort/filter interaction family. Use fields appropriate to deleted items: name, type, deletion/expiry time, and remaining retention. Do not expose irrelevant live-entry filters as if they applied to trash.
- Keep confirmation for permanent deletion and emptying the trash. Preserve recovery behavior and the 30-day retention policy.

### Settings

Preserve existing capabilities and group them for scanning:

- Appearance: system/light/dark theme and an application-controlled reduced-motion setting. Full Scanner motion is the default; reduced motion is an explicit setting.
- Recognition: enable/disable metadata recognition.
- Labels: manage platform and content labels.
- Data: export backup, merge import, and confirmed replacement import.
- Trash: show retention state and provide a route to the Trash page.

## Shared collection dialog

- Use one dialog for creating and editing entries, invoked from both Filter and Collections.
- Keep URL/share recognition, title, URL, author, platform label, content labels, and multiple-folder assignment; use the shared existing form behavior and validation.
- Require URL or author, allow either alone, preserve the original URL including query parameters, and never overwrite manually entered metadata with recognition results.
- Recognition failure must not block manual saving. Keep focus management, validation feedback, and keyboard dismissal accessible.
- The primary save action uses the SpecularButton reference with a restrained edge glow. Avoid persistent UI copy that merely explains business rules.

## Interaction, motion, and accessibility

- Provide visible focus, semantic names, keyboard operation, and appropriate focus return for CardSwap, dialogs, tree controls, menus, and table header controls.
- The Scanner's moving content is decorative and non-interactive. The reduced-motion preference must provide a static or substantially reduced-motion background while retaining readable color and contrast.
- Keep all function and content readable over Scanner at both themes and across loading, empty, error, and confirmation states.
- Use transitions only to explain entry, navigation, and selection. Do not delay access to the selected page with ornamental animation.

## Product boundaries

No account, cloud sync, upload of collection data, product AI/Agent/MCP, platform login, private API, or crawler behavior. UI work must not change SQLite schema, backup format, repository contracts, or the domain rules in `docs/srs.md`.

## Not specified by this document

Exact animation duration, component implementation details, new package versions, responsive breakpoint values, and large-list virtualization remain implementation decisions. Preserve the documented interaction outcomes and test them in the running desktop-sized interface.
