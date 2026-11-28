# Star Everything Frontend Design

## Purpose

A desktop-first personal collection workspace for quickly finding, saving, and organizing URLs and authors. The UI is an operational tool, not a marketing surface. Preserve the product rules in `docs/srs.md`; this document specifies the front-end information architecture and interaction language.

## Platform and visual references

- Runtime: existing TypeScript, React 19, and Tauri 2 desktop application for Linux and Windows.
- Primary viewport: 1080 x 720. Minimum supported window: 720 x 520.
- Use the user's React Bits references: `Scanner-JS-CSS`, `CrystalizedBall-JS-CSS`, `CardSwap-JS-CSS`, `GooeyNav-JS-CSS`, `SpecularButton-JS-CSS`, `SpringCheck-JS-CSS`, and `WakeSlider-JS-CSS`, installed through their documented `npx shadcn@latest add @react-bits/...` commands when implementation begins.
- Icons come from Lucide (`https://lucide.dev/icons/`) as inline SVG: `folder`, `folder-open`, `folder-plus`, `trash`, `pencil`, `rotate-ccw`, `move`, `plus`, `search`, `x`, `check`, `chevron-down`, and `arrow-up`/`arrow-down`. Do not hand-draw replacement glyphs or use text characters such as `×`, `＋`, `▾`, `▸`, `⌄`, or `↑`/`↓` where a Lucide icon exists — this includes table sort affordances. Size icons at 13-16px, keep `stroke-width` 2, and never let an SVG inherit an unsized container.
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
- Each folder exposes a menu for creating a child folder, renaming, moving, and deleting. The row itself stays the selection target, so the menu affordance is an icon button that appears on hover or focus instead of a second visible link. Preserve deletion impact confirmation and both existing deletion modes.
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
- Every button surface uses the SpecularButton reference with an 18px radius, including header actions, dialog footers, folder actions, and settings actions. Tones only change the specular line color and tint: plain, primary, danger.
- Both themes carry the same Dusk accent family, but the components whose colors live in WebGL shaders or CSS variables (the specular buttons and container rims, the GooeyNav pill, SpringCheck fills, the WakeSlider bars) need an explicit light set — the dark set washes out on a light surface. Anything that previews a page, such as the CardSwap previews, follows the active theme too; nothing should preview a palette the app is not currently using.
- Page containers (the table shell, folder tree panel, row-detail pane, and settings sections) also use the SpecularButton rim: the same shader on the container edge with a much lower intensity than a button, so it reads as a lit border rather than a control. All page-container corners are 15px; buttons stay at 18px.
- The collection table keeps its full set of columns. On wide windows it keeps naturally sized columns inside its own scroll container; once the list itself is narrower than the six columns need (measured on the list container, not the window, so an open detail pane counts), columns compress with a fixed layout and wrapped cell text so nothing is clipped behind the scroll edge. Wrapping breaks a word only when the cell truly cannot hold it, so names stay whole wherever they fit. Saved-time and remaining-days values stay on one line.
- Value sliders — currently the panel opacity control in Settings — use the `WakeSlider` reference instead of a native `input[type=range]`: equalizer bars that wake up around the handle while dragging, with the same Dusk fill/track colors and a visible percentage readout beside it.

## Interaction, motion, and accessibility

- Provide visible focus, semantic names, keyboard operation, and appropriate focus return for CardSwap, dialogs, tree controls, menus, and table header controls.
- Use the `SpringCheck` reference for every checkbox-style control, including sort and filter options in the table column dialog, the folder assignment list in the collection dialog, and the on/off toggles in Settings. Selection is conveyed by the SpringCheck tick/fill animation, not by darkening a row or panel background; a switch-shaped control is never used.
- Hide the browser's own scrollbar chrome (`::-webkit-scrollbar` for WebKit/Chromium and `scrollbar-width: none` for Firefox) on every scrolling region, including dialogs and menus that mount on demand. Scrolling itself stays native — wheel, trackpad, keyboard, and focus behavior are unchanged — so no custom scrollbar track replaces it.
- Side panes enter from their own edge: a pane docked on the right slides in from the right, a pane docked on the left slides in from the left. The pane must not fade in place or fly in from the opposite side, and the motion is skipped under reduced motion.

## Entry and row detail

- The entry screen uses the `CrystalizedBall` eclipse configuration with a white tint and its full particle count. Only the small top-left ball shown after entering uses the sparser, tinted configuration. Returning to the entry screen moves the small ball from the top-left corner to the centre instead of cutting to a new screen.
- Row detail is a sibling pane at the same level as the collection list, not a modal dialog. It opens on the right of the collection page and on the left of the filter and trash pages, from its own edge. While the list still has room for its columns, the pane docks beside it, shares its height, and pushes the list instead of covering it. Once docking would squeeze the list below usability, the pane becomes a side sheet on the same edge rather than shrinking the list into a sliver.
- Row-level actions (edit, move to trash, restore, delete permanently) are icon buttons in the pane's top corner. They replace the table action column entirely; the row itself is the entry point.
- The Scanner's moving content is decorative and non-interactive. The reduced-motion preference must provide a static or substantially reduced-motion background while retaining readable color and contrast.
- Keep all function and content readable over Scanner at both themes and across loading, empty, error, and confirmation states.
- Use transitions only to explain entry, navigation, and selection. Do not delay access to the selected page with ornamental animation.

## Product boundaries

No account, cloud sync, upload of collection data, product AI/Agent/MCP, platform login, private API, or crawler behavior. UI work must not change SQLite schema, backup format, repository contracts, or the domain rules in `docs/srs.md`.

## Not specified by this document

Exact animation duration, component implementation details, new package versions, responsive breakpoint values, and large-list virtualization remain implementation decisions. Preserve the documented interaction outcomes and test them in the running desktop-sized interface.
