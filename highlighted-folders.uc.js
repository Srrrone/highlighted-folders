/* ==========================================================================
   Highlighted Folders — colored folder grouping for Zen Browser
   --------------------------------------------------------------------------
   v3 — background covers the WHOLE folder block (header + every child
   tab row) as one solid rounded panel, instead of just a header chip
   with a border on the children.
   ========================================================================== */

:root {
  --hf-color-1: #0a84ff;
  --hf-color-2: #ff6a00;
  --hf-color-3: #32d74b;
  --hf-color-4: #bf5af2;
  --hf-color-5: #ffd60a;
  --hf-color-6: #ff6482;

  --hf-bg-opacity: 16%;
  --hf-bg-opacity-hover: 26%;
  /* Matches the radius Zen's own sidebar TABS use for their hover/selected
     highlight (--tab-border-radius, 8px) rather than the larger, more
     "pill" --border-radius-medium (14px) used elsewhere in the chrome —
     see #navigator-toolbox in vertical-tabs.css. This keeps the folder
     panel's corners visually the same tightness as a regular tab row.
     The script only overrides this if you set a custom radius in the mod
     settings. */
  --hf-radius: var(--tab-border-radius, 8px);
}

/* Fallback-only color assignment, used only if highlighted-folders.uc.js
   isn't actually running (e.g. Sine's "unsafe JS" toggle is off). Once the
   script runs, it sets --hf-color inline on each zen-folder, which always
   wins over this since inline style beats a stylesheet rule. */
zen-folder:nth-of-type(6n+1) { --hf-color-fallback: var(--hf-color-1); }
zen-folder:nth-of-type(6n+2) { --hf-color-fallback: var(--hf-color-2); }
zen-folder:nth-of-type(6n+3) { --hf-color-fallback: var(--hf-color-3); }
zen-folder:nth-of-type(6n+4) { --hf-color-fallback: var(--hf-color-4); }
zen-folder:nth-of-type(6n+5) { --hf-color-fallback: var(--hf-color-5); }
zen-folder:nth-of-type(6n)   { --hf-color-fallback: var(--hf-color-6); }

/* --------------------------------------------------------------------
   Three visual states per folder:
   - Closed, not hovered: only the folder name is tinted, no fill.
   - Hovered (open or closed): the whole header/panel fills brighter.
   - Open (expanded, showing its tabs): filled at the dimmer base tint
     always, brighter again on hover.
   -------------------------------------------------------------------- */
zen-folder {
  --hf-resolved-color: var(--hf-color, var(--hf-color-fallback, var(--zen-primary-color)));

  border-radius: var(--hf-radius) !important;
  padding-block: 2px !important;
  margin-block-end: 4px !important;
  transition: background-color 160ms ease, box-shadow 160ms ease !important;

  /* Recolor the folder icon itself to match (same custom properties
     Zen's own icon SVG reads from — see ZenFolder.mjs). Always on,
     regardless of open/closed/hover state. */
  --zen-folder-behind-bgcolor: color-mix(in srgb, var(--hf-resolved-color) 60%, gray) !important;
  --zen-folder-front-bgcolor: color-mix(in srgb, var(--hf-resolved-color), white 70%) !important;
  --zen-folder-stroke: color-mix(in srgb, var(--hf-resolved-color) 50%, black) !important;
}

/* Base state: no fill, just a colored, bold folder name. The color
   itself is darkened slightly in light mode and lightened slightly in
   dark mode (via light-dark(), the same function Zen's own styles use)
   so it stays readable on its own — flat and matte, no shadow/glow. */
zen-folder > .tab-group-label-container .tab-group-label {
  font-weight: 600 !important;
  color: light-dark(
    color-mix(in srgb, var(--hf-resolved-color) 70%, black),
    color-mix(in srgb, var(--hf-resolved-color) 85%, white)
  ) !important;
}

/* The header's own hover highlight (Zen's ::before layer) is fully
   neutralized — background always transparent. All filling happens on
   the outer zen-folder element itself, in every state, so hover and
   open always share the exact same box instead of two differently
   sized layers that can leave a visible seam. */
zen-folder > .tab-group-label-container::before {
  background-color: transparent !important;
}

/* Open: solid panel fill covering the header AND every child tab row,
   as one box. A soft shadow plus a faint inner ring gives it a
   slightly raised, clean card look instead of a flat color patch. */
zen-folder:not([collapsed]) {
  background-color: color-mix(in srgb, var(--hf-resolved-color) var(--hf-bg-opacity), transparent) !important;
  box-shadow:
    0 1px 3px color-mix(in srgb, black 18%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--hf-resolved-color) 22%, transparent) !important;
}

/* Hovering anywhere within an already-open folder brightens the WHOLE
   box uniformly — header and every child row together, all at once,
   since this is one single rule on the outer element rather than a
   separate header-only layer. Not hovering leaves the base (dimmer)
   tint from the rule above still visible, so the folder always reads
   as "group colored," with a brighter highlight layered on top only
   while you're actually hovering it. */
zen-folder:not([collapsed]):hover {
  background-color: color-mix(in srgb, var(--hf-resolved-color) var(--hf-bg-opacity-hover), transparent) !important;
}

/* Collapsed folders fill on hover, using the exact same box the open
   state uses — so going from "hovering, collapsed" to "open" is the
   same element smoothly changing opacity, not a swap between two
   different-shaped layers. */
zen-folder[collapsed]:hover {
  background-color: color-mix(in srgb, var(--hf-resolved-color) var(--hf-bg-opacity-hover), transparent) !important;
  box-shadow:
    0 1px 3px color-mix(in srgb, black 18%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--hf-resolved-color) 22%, transparent) !important;
}

/* A collapsed folder that contains the currently active tab stays
   filled/highlighted, same as an open folder — Zen already tracks this
   via the [has-active] attribute on collapsed folders. A collapsed
   folder with no active tab inside stays unhighlighted as normal. */
zen-folder[collapsed][has-active] {
  background-color: color-mix(in srgb, var(--hf-resolved-color) var(--hf-bg-opacity), transparent) !important;
  box-shadow:
    0 1px 3px color-mix(in srgb, black 18%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--hf-resolved-color) 22%, transparent) !important;
}

/* [collapsed][has-active] and [collapsed]:hover tie in specificity, so
   whichever comes later in the file wins regardless of whether you're
   actually hovering — which silently blocked hover brightening on a
   collapsed folder that already contained the active tab. This rule has
   one more selector than either, so it always wins outright when both
   are true, guaranteeing hover still visibly brightens things further. */
zen-folder[collapsed][has-active]:hover {
  background-color: color-mix(in srgb, var(--hf-resolved-color) var(--hf-bg-opacity-hover), transparent) !important;
}

/* Note: the label text intentionally does NOT switch to a different
   color in any of the states above (open, hovered, collapsed+active) —
   it stays the same light-dark-adjusted accent color set on the base
   rule further up, so the folder name never looks like it's "turning
   black" once the panel fills in. */

/* A small, self-contained bounce when a folder opens or closes —
   triggered by highlighted-folders.uc.js toggling this class whenever a
   folder's [collapsed] attribute changes. */
@keyframes hf-folder-bounce {
  0%   { transform: scaleY(1); }
  45%  { transform: scaleY(1.025); }
  75%  { transform: scaleY(0.99); }
  100% { transform: scaleY(1); }
}

zen-folder.hf-bounce {
  animation: hf-folder-bounce 240ms cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  transform-origin: top center !important;
}

/* --------------------------------------------------------------------
   Color submenu — right-click a folder → "Highlight Color" → a list of
   preset swatches. Swatches are real <menuitem> elements with a colored
   circular PNG icon, rendered as a plain vertical list — native
   menupopup layout, no flex/grid CSS override (that didn't render
   consistently across platforms).
   -------------------------------------------------------------------- */
#context-hf-color-swatches {
  width: 160px !important;
  max-width: 160px !important;
}

.hf-swatch-item {
  -moz-appearance: none !important;
  padding: 4px 8px !important;
}

.hf-swatch-item > .menu-iconic-icon {
  width: 18px !important;
  height: 18px !important;
  margin-inline-end: 8px !important;
}

.hf-swatch-item:hover {
  background-color: color-mix(in srgb, currentColor 14%, transparent) !important;
}

.hf-swatch-divider {
  margin: 4px 2px !important;
}

/* ==========================================================================
   Dia-style sidebar top — pinned icon grid + integrated window controls
   --------------------------------------------------------------------------
   Scope: the pinned "Essentials" row styled as rounded Dia-style tiles,
   the Spaces switcher moved up next to the window control buttons (the
   actual move happens in highlighted-folders.uc.js — CSS can't relocate
   an element between two separate toolbars), and the sidebar stretched
   to fill the full window height.

   The essentials-grid and top-buttons technique was worked out by
   reading z1n-k/zia's chrome.css (https://github.com/z1n-k/zia) as
   reference, per request — these are real native Zen elements
   (.zen-essentials-container, .tabbrowser-tab[zen-essential],
   #zen-sidebar-top-buttons), not anything invented; the values below
   are our own.
   ========================================================================== */

:root {
  --dia-essential-radius: 12px;
  --dia-essential-gap: 3px;
  --dia-essential-min-width: 54px;
  --dia-essential-max-width: 120px;
  --dia-essential-height: 41px;
  --dia-essential-bg: rgba(255, 255, 255, 0.13);
  --dia-essential-bg-hover: rgba(255, 255, 255, 0.16);
  --dia-essential-bottom-space: 8px;
  --dia-top-row-space: 6.5px;
}

/* Pinned tabs ("Essentials") as a rounded tile grid — a fixed 4-column
   grid, matching Dia's own row count exactly, instead of auto-fill
   (which wraps to an inconsistent number per row depending on
   available width — the uneven "5 then 1" layout you saw). */
:root[zen-sidebar-expanded="true"] .zen-essentials-container {
  grid-template-columns: repeat(4, 1fr) !important;
  gap: var(--dia-essential-gap) !important;
  padding-bottom: var(--dia-essential-bottom-space) !important;
}

:root[zen-sidebar-expanded="true"] .zen-essentials-container > .tabbrowser-tab[zen-essential] {
  min-width: 0 !important;
  max-width: var(--dia-essential-max-width) !important;
  width: 100% !important;
}

:root[zen-sidebar-expanded="true"] #zen-essentials {
  --tab-min-height: var(--dia-essential-height) !important;
}

.tabbrowser-tab[zen-essential] > .tab-stack > .tab-background {
  border-radius: var(--dia-essential-radius) !important;
}

.tabbrowser-tab[zen-essential]:not([visuallyselected]) > .tab-stack > .tab-background {
  background: var(--dia-essential-bg) !important;
}

.tabbrowser-tab[zen-essential]:not([visuallyselected]):hover > .tab-stack > .tab-background {
  background: var(--dia-essential-bg-hover) !important;
}

/* Sidebar top area — window control buttons, now joined by the Spaces
   switcher (moved here by the script). Extra gap and centered alignment
   so both sit together cleanly instead of cramped against each other. */
#zen-sidebar-top-buttons {
  margin-block: var(--dia-top-row-space) !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

#zen-sidebar-top-buttons .titlebar-buttonbox-container {
  margin-inline-start: 5px !important;
  margin-top: 3px !important;
}

#zen-sidebar-top-buttons #zen-workspaces-button {
  margin-inline-start: auto !important;
  margin-inline-end: 6px !important;
}

/* Full-height sidebar — stretches the sidebar panel edge to edge with
   no top/bottom gap. Best-effort: if your sidebar is already in Zen's
   own floating/compact layout mode, this should just reinforce that; if
   you're in a different layout mode, this may not be the full picture
   since the floating panel SHAPE itself is a native Zen layout setting,
   not something this rule creates from scratch. */
#navigator-toolbox {
  height: 100% !important;
  margin-block: 0 !important;
}

/* --------------------------------------------------------------------
   Window control buttons, restyled as small macOS-style colored dots
   (Dia's look) instead of Zen's default square min/max/restore/close
   buttons. These are real native elements
   (.titlebar-buttonbox-container > .titlebar-buttonbox > .titlebar-button),
   confirmed via the console to already live inside
   #zen-sidebar-top-buttons on this setup — nothing needed to move
   them, just to reshape them.
   -------------------------------------------------------------------- */
#zen-sidebar-top-buttons .titlebar-buttonbox-container,
#zen-sidebar-top-buttons .titlebar-buttonbox {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  height: auto !important;
  width: auto !important;
}

#zen-sidebar-top-buttons .titlebar-button {
  -moz-appearance: none !important;
  appearance: none !important;
  width: 12px !important;
  height: 12px !important;
  min-width: 12px !important;
  min-height: 12px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
}

#zen-sidebar-top-buttons .titlebar-button > .toolbarbutton-icon,
#zen-sidebar-top-buttons .titlebar-button > .toolbarbutton-text {
  display: none !important;
}

#zen-sidebar-top-buttons .titlebar-button.titlebar-min {
  background-color: #febc2e !important;
}

#zen-sidebar-top-buttons .titlebar-button.titlebar-max,
#zen-sidebar-top-buttons .titlebar-button.titlebar-restore {
  background-color: #28c840 !important;
}

#zen-sidebar-top-buttons .titlebar-button.titlebar-close {
  background-color: #ff5f57 !important;
}

#zen-sidebar-top-buttons .titlebar-button:hover {
  filter: brightness(1.15) !important;
}
