// ==UserScript==
// @name           Highlighted Folders
// @description    Colors each Zen folder, with a real "Change Color…" entry
//                  added to the folder's own right-click menu.
// @version        2.0.0
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

  const DEFAULT_PALETTE = ['#7c9eff', '#ff9f7c', '#7cffb3', '#d67cff', '#ffe27c', '#7cf0ff'];

  const CONTEXT_MENU_ID = 'zenFolderActions';
  const ANCHOR_ITEM_ID = 'context_zenFolderChangeIcon';
  const CHANGE_COLOR_ID = 'context-hf-change-color';
  const RESET_COLOR_ID = 'context-hf-reset-color';

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

  function applyFolderColors() {
    const palette = readPalette();
    const overrides = readOverrides();
    const opacity = readStringPref(PREF_OPACITY, '16');
    const opacityHover = readStringPref(PREF_OPACITY_HOVER, '26');
    const radius = readStringPref(PREF_RADIUS, ''); // blank = inherit Zen's own radius
    const colorTopLevel = readBoolPref(PREF_COLOR_TOP_LEVEL, true);

    const folders = document.querySelectorAll('zen-folder');
    folders.forEach((folder) => {
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
    });
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
    const observer = new MutationObserver(scheduleApply);
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['label', 'id']
    });
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

  function ensureMenuItems(menupopup) {
    if (document.getElementById(CHANGE_COLOR_ID)) return;

    const anchor = document.getElementById(ANCHOR_ITEM_ID);

    const changeColorItem = document.createXULElement('menuitem');
    changeColorItem.id = CHANGE_COLOR_ID;
    changeColorItem.setAttribute('label', 'Change Color…');

    const resetColorItem = document.createXULElement('menuitem');
    resetColorItem.id = RESET_COLOR_ID;
    resetColorItem.setAttribute('label', 'Reset Folder Color');

    if (anchor?.nextSibling) {
      anchor.after(changeColorItem, resetColorItem);
    } else {
      menupopup.appendChild(changeColorItem);
      menupopup.appendChild(resetColorItem);
    }
  }

  function initContextMenu() {
    const menupopup = document.getElementById(CONTEXT_MENU_ID);
    if (!menupopup) return;

    let pendingFolder = null;

    menupopup.addEventListener('popupshowing', (event) => {
      pendingFolder = resolveFolderFromEvent(event);
      ensureMenuItems(menupopup);

      const hasFolder = !!pendingFolder;
      document.getElementById(CHANGE_COLOR_ID)?.toggleAttribute('disabled', !hasFolder);
      document.getElementById(RESET_COLOR_ID)?.toggleAttribute('disabled', !hasFolder);
    });

    menupopup.addEventListener('command', async (event) => {
      if (!pendingFolder) return;
      const folderId = pendingFolder.id;

      if (event.target.id === CHANGE_COLOR_ID) {
        const overrides = readOverrides();
        const current = overrides[folderId] || null;
        const chosen = await pickColor(current);
        if (chosen) {
          setFolderOverride(folderId, chosen);
          applyFolderColors();
        }
      } else if (event.target.id === RESET_COLOR_ID) {
        clearFolderOverride(folderId);
        applyFolderColors();
      }
    });
  }

  function init() {
    applyFolderColors();
    observeSidebar();
    observePrefs();
    initContextMenu();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }
})();
