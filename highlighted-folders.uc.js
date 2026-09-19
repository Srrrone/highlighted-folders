// ==UserScript==
// @name           Highlighted Folders
// @description    Colors each Zen folder, with a real "Change Color…" entry
//                  added to the folder's own right-click menu.
// @version        3.2.0
// ==/UserScript==

(() => {
  'use strict';

  const PREF_BRANCH = 'srrrone.highlighted-folders.';
  const PREF_PALETTE = `${PREF_BRANCH}palette`;
  const PREF_OPACITY = `${PREF_BRANCH}opacity`;
  const PREF_OPACITY_HOVER = `${PREF_BRANCH}opacity-hover`;
  const PREF_RADIUS = `${PREF_BRANCH}radius`;
  const PREF_COLOR_TOP_LEVEL = `${PREF_BRANCH}color-top-level`;
  // Per-folder manual color overrides, set via the right-click menu.
  // Stored as JSON: { "<folder-id>": "#rrggbb", ... }
  const PREF_OVERRIDES = `${PREF_BRANCH}overrides`;

  const DEFAULT_PALETTE = ['#0a84ff', '#ff6a00', '#32d74b', '#bf5af2', '#ffd60a', '#ff6482'];

  const CONTEXT_MENU_ID = 'zenFolderActions';
  const ANCHOR_ITEM_ID = 'context_zenFolderChangeIcon';
  const COLOR_MENU_ID = 'context-hf-color-menu';
  const SWATCH_POPUP_ID = 'context-hf-color-swatches';
  const CUSTOM_SWATCH_ID = 'context-hf-swatch-custom';
  const RESET_COLOR_ID = 'context-hf-reset-color';

  // Preset colors shown as a small icon-grid submenu, matching a vivid
  // "primary" palette (white, green, blue, purple, yellow, pink, red,
  // orange). The actual custom-color escape hatch is added separately,
  // on its own row below a divider — see buildColorMenu.
  const SWATCH_COLORS = [
    '#ffffff', '#32d74b', '#0a84ff', '#bf5af2',
    '#ffd60a', '#ff6482', '#ef2b23', '#ff6a00'
  ];
  const SWATCH_NAMES = ['White', 'Green', 'Blue', 'Purple', 'Yellow', 'Pink', 'Red', 'Orange'];

  // Menuitem "image" attributes need a real image resource — inline SVG
  // Menuitem "image" attributes need a real image resource. PNG (via an
  // offscreen <canvas>) is used here instead of an inline SVG data URI —
  // native menu-icon painting on Windows doesn't reliably support SVG
  // data URIs the way macOS/Linux do, so rasterizing to PNG is the
  // version that's actually guaranteed to render on every platform.
  // Falls back to the SVG data URI only if canvas itself is unavailable.
  function drawSwatchCanvas(hexColor, neutral) {
    const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 16, 16);

    // Dark outer ring, for definition against a light menu background.
    ctx.beginPath();
    ctx.arc(8, 8, 7.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Fill.
    ctx.beginPath();
    ctx.arc(8, 8, 6.75, 0, Math.PI * 2);
    ctx.fillStyle = neutral ? '#5a5a5e' : hexColor;
    ctx.fill();

    // Light inner ring, for definition against a dark menu background.
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (neutral) {
      ctx.beginPath();
      ctx.arc(8, 8, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    }

    return canvas.toDataURL('image/png');
  }

  function svgFallbackDataUri(hexColor, neutral) {
    const centerDot = neutral ? `<circle cx="8" cy="8" r="2.5" fill="rgba(255,255,255,0.55)"/>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
      `<circle cx="8" cy="8" r="7.5" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>` +
      `<circle cx="8" cy="8" r="6.75" fill="${neutral ? '#5a5a5e' : hexColor}" stroke="rgba(255,255,255,0.65)" stroke-width="1"/>` +
      centerDot + `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function swatchIconDataUri(hexColor) {
    try {
      return drawSwatchCanvas(hexColor, false);
    } catch {
      return svgFallbackDataUri(hexColor, false);
    }
  }

  function neutralIconDataUri() {
    try {
      return drawSwatchCanvas(null, true);
    } catch {
      return svgFallbackDataUri(null, true);
    }
  }

  function getPrefs() {
    try {
      return Services.prefs;
    } catch {
      return null;
    }
  }

  function readPalette() {
    const prefs = getPrefs();
    let raw = '';
    try {
      raw = prefs?.getStringPref(PREF_PALETTE, '') || '';
    } catch {}
    const parsed = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    return parsed.length ? parsed : DEFAULT_PALETTE;
  }

  function readStringPref(name, fallback) {
    const prefs = getPrefs();
    try {
      const value = prefs?.getStringPref(name, '');
      return value || fallback;
    } catch {
      return fallback;
    }
  }

  function readBoolPref(name, fallback) {
    const prefs = getPrefs();
    try {
      return prefs?.getBoolPref(name, fallback);
    } catch {
      return fallback;
    }
  }

  function readOverrides() {
    const prefs = getPrefs();
    let raw = '';
    try {
      raw = prefs?.getStringPref(PREF_OVERRIDES, '') || '';
    } catch {}
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeOverrides(overrides) {
    const prefs = getPrefs();
    try {
      prefs?.setStringPref(PREF_OVERRIDES, JSON.stringify(overrides));
    } catch {}
  }

  function setFolderOverride(folderId, hexColor) {
    if (!folderId) return;
    const overrides = readOverrides();
    overrides[folderId] = hexColor;
    writeOverrides(overrides);
  }

  function clearFolderOverride(folderId) {
    if (!folderId) return;
    const overrides = readOverrides();
    if (folderId in overrides) {
      delete overrides[folderId];
      writeOverrides(overrides);
    }
  }

  // Stable string hash (djb2) — same input always produces the same output.
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function isTopLevelFolder(folder) {
    return !folder.parentElement?.closest('zen-folder');
  }

  function colorForFolder(folder, palette, overrides) {
    const key = folder.id || folder.getAttribute('label') || '';
    if (overrides[key]) return overrides[key];
    const hash = hashString(key);
    return palette[hash % palette.length];
  }

  function applyColorToFolder(folder, options = {}) {
    const {
      palette = readPalette(),
      overrides = readOverrides(),
      opacity = readStringPref(PREF_OPACITY, '16'),
      opacityHover = readStringPref(PREF_OPACITY_HOVER, '26'),
      radius = readStringPref(PREF_RADIUS, ''), // blank = inherit Zen's own radius
      colorTopLevel = readBoolPref(PREF_COLOR_TOP_LEVEL, true)
    } = options;

    const topLevel = isTopLevelFolder(folder);
    if (topLevel && !colorTopLevel) {
      folder.style.removeProperty('--hf-color');
      return;
    }

    folder.style.setProperty('--hf-color', colorForFolder(folder, palette, overrides));
    folder.style.setProperty('--hf-bg-opacity', `${opacity}%`);
    folder.style.setProperty('--hf-bg-opacity-hover', `${opacityHover}%`);
    if (radius) {
      folder.style.setProperty('--hf-radius', `${radius}px`);
    } else {
      folder.style.removeProperty('--hf-radius');
    }
  }

  // Full sweep — used on startup, on sidebar mutations (folders added/
  // renamed), and when a pref that affects every folder changes (palette,
  // opacity, radius, top-level toggle).
  function applyFolderColors() {
    const options = {
      palette: readPalette(),
      overrides: readOverrides(),
      opacity: readStringPref(PREF_OPACITY, '16'),
      opacityHover: readStringPref(PREF_OPACITY_HOVER, '26'),
      radius: readStringPref(PREF_RADIUS, ''),
      colorTopLevel: readBoolPref(PREF_COLOR_TOP_LEVEL, true)
    };

    document.querySelectorAll('zen-folder').forEach((folder) => {
      applyColorToFolder(folder, options);
    });
  }

  // Targeted update — used right after picking/resetting one folder's
  // color, so only that single element's style changes instead of
  // rewriting every folder in the sidebar at once. Touching every
  // zen-folder on every click is what was causing the brief sidebar
  // flicker after choosing a color.
  function applyColorToSingleFolder(folder) {
    if (!folder) return;
    applyColorToFolder(folder);
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFolderColors();
    });
  }

  function observeSidebar() {
    const target = document.getElementById('tabbrowser-tabs') || document.documentElement;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'collapsed') {
          triggerBounce(mutation.target);
        }
      }
      scheduleApply();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['label', 'id', 'collapsed']
    });
  }

  // Briefly adds the CSS bounce animation class whenever a folder opens
  // or closes, then removes it once the animation finishes (falls back
  // to a timeout if 'animationend' never fires for some reason, so the
  // class can't get stuck on).
  function triggerBounce(folder) {
    if (!folder || folder.tagName !== 'ZEN-FOLDER') return;
    folder.classList.remove('hf-bounce');
    // Force reflow so re-adding the class restarts the animation even
    // if it's still mid-way from a very quick prior toggle.
    void folder.offsetWidth;
    folder.classList.add('hf-bounce');

    const clear = () => folder.classList.remove('hf-bounce');
    folder.addEventListener('animationend', clear, { once: true });
    setTimeout(clear, 400);
  }

  function observePrefs() {
    const prefs = getPrefs();
    if (!prefs?.addObserver) return;

    const observer = {
      observe(_subject, topic, prefName) {
        if (topic === 'nsPref:changed' && String(prefName || '').startsWith(PREF_BRANCH)) {
          applyFolderColors();
        }
      }
    };

    try {
      prefs.addObserver(PREF_BRANCH, observer);
    } catch {}
  }

  // Opens the OS-native color picker via a throwaway <input type="color">.
  // This is the standard way to get a real color picker from a privileged
  // chrome document without building custom UI.
  function pickColor(defaultColor) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = /^#[0-9a-f]{6}$/i.test(defaultColor || '') ? defaultColor : '#7c9eff';
      input.style.position = 'fixed';
      input.style.top = '-9999px';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.documentElement.appendChild(input);

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(value);
      };

      input.addEventListener('change', () => finish(input.value));
      input.addEventListener('blur', () => {
        // Give 'change' a chance to fire first if the picker was accepted.
        setTimeout(() => finish(null), 250);
      });

      input.click();
    });
  }

  // Mirrors Zen's own folder-detection logic from ZenFolders.mjs so we
  // identify the right-clicked folder the same way Zen does internally.
  function resolveFolderFromEvent(event) {
    const target = event.explicitOriginalTarget;
    let folder = null;

    if (typeof gBrowser?.isTabGroupLabel === 'function' && gBrowser.isTabGroupLabel(target)) {
      folder = target.group;
    } else if (
      target?.parentElement &&
      typeof gBrowser?.isTabGroupLabel === 'function' &&
      gBrowser.isTabGroupLabel(target.parentElement)
    ) {
      folder = target.parentElement.group;
    } else if (
      target?.parentElement?.isZenFolder &&
      target?.classList?.contains('tab-group-label-container')
    ) {
      folder = target.parentElement;
    }

    return folder?.isZenFolder ? folder : null;
  }

  function buildColorMenu(menupopup, getPendingFolder) {
    const menu = document.createXULElement('menu');
    menu.id = COLOR_MENU_ID;
    menu.setAttribute('label', 'Highlight Color');

    const popup = document.createXULElement('menupopup');
    popup.id = SWATCH_POPUP_ID;
    menu.appendChild(popup);

    SWATCH_COLORS.forEach((color, index) => {
      const item = document.createXULElement('menuitem');
      item.classList.add('hf-swatch-item');
      item.setAttribute('label', SWATCH_NAMES[index] || color);
      item.setAttribute('tooltiptext', color);
      item.setAttribute('image', swatchIconDataUri(color));
      item.setAttribute('data-color', color);
      popup.appendChild(item);
    });

    // A visible divider line, separating the custom-color option below
    // from the fixed presets above it.
    const divider = document.createXULElement('menuseparator');
    divider.classList.add('hf-swatch-divider');
    popup.appendChild(divider);

    const customItem = document.createXULElement('menuitem');
    customItem.id = CUSTOM_SWATCH_ID;
    customItem.classList.add('hf-swatch-item', 'hf-swatch-custom-item');
    customItem.setAttribute('data-custom', 'true');
    customItem.setAttribute('label', 'Custom Color…');
    customItem.setAttribute('tooltiptext', 'Custom Color…');
    customItem.setAttribute('image', neutralIconDataUri());
    popup.appendChild(customItem);

    popup.addEventListener('command', async (event) => {
      const folder = getPendingFolder();
      if (!folder) return;

      if (event.target.getAttribute('data-custom') === 'true') {
        const overrides = readOverrides();
        const current = overrides[folder.id] || null;
        const chosen = await pickColor(current);
        if (chosen) {
          setFolderOverride(folder.id, chosen);
          applyColorToSingleFolder(folder);
        }
        return;
      }

      const color = event.target.getAttribute('data-color');
      if (color) {
        setFolderOverride(folder.id, color);
        applyColorToSingleFolder(folder);
      }
    });

    return menu;
  }

  function ensureMenuItems(menupopup, getPendingFolder) {
    if (document.getElementById(COLOR_MENU_ID)) return;

    const anchor = document.getElementById(ANCHOR_ITEM_ID);
    const colorMenu = buildColorMenu(menupopup, getPendingFolder);

    const resetColorItem = document.createXULElement('menuitem');
    resetColorItem.id = RESET_COLOR_ID;
    resetColorItem.setAttribute('label', 'Reset Folder Color');

    if (anchor) {
      anchor.after(colorMenu, resetColorItem);
    } else {
      menupopup.appendChild(colorMenu);
      menupopup.appendChild(resetColorItem);
    }
  }

  function updateCustomSwatchPreview(folder) {
    const customItem = document.getElementById(CUSTOM_SWATCH_ID);
    if (!customItem) return;

    const overrides = readOverrides();
    const current = folder ? overrides[folder.id] : null;
    const isPreset = current && SWATCH_COLORS.some((c) => c.toLowerCase() === current.toLowerCase());

    if (current && !isPreset) {
      customItem.setAttribute('image', swatchIconDataUri(current));
      customItem.setAttribute('tooltiptext', `Custom Color… (currently ${current})`);
    } else {
      customItem.setAttribute('image', neutralIconDataUri());
      customItem.setAttribute('tooltiptext', 'Custom Color…');
    }
  }

  function initContextMenu() {
    const menupopup = document.getElementById(CONTEXT_MENU_ID);
    if (!menupopup) return;

    // Track the right-clicked folder from the raw 'contextmenu' event
    // itself (capture phase, on the whole document) rather than trying to
    // re-derive it inside 'popupshowing'. This popup only ever opens when
    // a folder's own header was right-clicked (Zen sets the `context`
    // attribute only on that element), so whatever we captured here is
    // guaranteed fresh for the popup that's about to show.
    let lastRightClickedFolder = null;
    document.addEventListener(
      'contextmenu',
      (event) => {
        const folder = resolveFolderFromEvent(event);
        if (folder) lastRightClickedFolder = folder;
      },
      true
    );

    const getPendingFolder = () => lastRightClickedFolder;

    menupopup.addEventListener('popupshowing', () => {
      ensureMenuItems(menupopup, getPendingFolder);
      updateCustomSwatchPreview(lastRightClickedFolder);

      const hasFolder = !!lastRightClickedFolder;
      document.getElementById(COLOR_MENU_ID)?.toggleAttribute('disabled', !hasFolder);
      document.getElementById(RESET_COLOR_ID)?.toggleAttribute('disabled', !hasFolder);
    });

    menupopup.addEventListener('command', (event) => {
      if (!lastRightClickedFolder) return;
      if (event.target.id === RESET_COLOR_ID) {
        clearFolderOverride(lastRightClickedFolder.id);
        applyColorToSingleFolder(lastRightClickedFolder);
      }
    });
  }

  // Direct click-based bounce trigger — catches the actual click that
  // opens/closes a folder, rather than relying only on observing the
  // [collapsed] attribute change (which didn't reliably fire the
  // animation on its own). Runs alongside that observer, not instead of
  // it, as a second, more direct path to the same effect.
  function initClickBounce() {
    document.addEventListener(
      'click',
      (event) => {
        const label = event.target?.closest?.('.tab-group-label-container');
        if (!label) return;
        const folder = label.parentElement;
        if (folder?.tagName !== 'ZEN-FOLDER') return;
        // Wait a frame so [collapsed] has already toggled by the time
        // anything else reacts to it; doesn't actually matter for the
        // bounce itself, which just restarts a fixed animation.
        requestAnimationFrame(() => triggerBounce(folder));
      },
      true
    );
  }

  function init() {
    applyFolderColors();
    observeSidebar();
    observePrefs();
    initContextMenu();
    initClickBounce();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }
})();
