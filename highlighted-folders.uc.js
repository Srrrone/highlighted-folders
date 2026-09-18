// ==UserScript==
// @name           Highlighted Folders
// @description    Assigns each Zen folder a stable color, hashed from its
//                  own internal id, so a folder keeps the same color
//                  across restarts, reordering, and space switches.
// @version        1.0.0
// ==/UserScript==

(() => {
  'use strict';

  const PREF_BRANCH = 'srrrone.highlighted-folders.';
  const PREF_PALETTE = `${PREF_BRANCH}palette`;
  const PREF_OPACITY = `${PREF_BRANCH}opacity`;
  const PREF_OPACITY_HOVER = `${PREF_BRANCH}opacity-hover`;
  const PREF_RADIUS = `${PREF_BRANCH}radius`;
  const PREF_COLOR_TOP_LEVEL = `${PREF_BRANCH}color-top-level`;

  const DEFAULT_PALETTE = ['#7c9eff', '#ff9f7c', '#7cffb3', '#d67cff', '#ffe27c', '#7cf0ff'];

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

  // Stable string hash (djb2). Same input always produces the same output,
  // which is what makes a folder's color "stick" across sessions.
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

  function colorForFolder(folder, palette) {
    // folder.id is Firefox's own tab-group id — stable across restarts
    // and session restore. Fall back to the visible label if it's ever
    // missing, so a folder still gets *a* consistent color.
    const key = folder.id || folder.getAttribute('label') || '';
    const hash = hashString(key);
    return palette[hash % palette.length];
  }

  function applyFolderColors() {
    const palette = readPalette();
    const opacity = readStringPref(PREF_OPACITY, '16');
    const opacityHover = readStringPref(PREF_OPACITY_HOVER, '26');
    const radius = readStringPref(PREF_RADIUS, '8');
    const colorTopLevel = readBoolPref(PREF_COLOR_TOP_LEVEL, true);

    const folders = document.querySelectorAll('zen-folder');
    folders.forEach((folder) => {
      const topLevel = isTopLevelFolder(folder);
      if (topLevel && !colorTopLevel) {
        folder.style.removeProperty('--hf-color');
        return;
      }

      folder.style.setProperty('--hf-color', colorForFolder(folder, palette));
      folder.style.setProperty('--hf-bg-opacity', `${opacity}%`);
      folder.style.setProperty('--hf-bg-opacity-hover', `${opacityHover}%`);
      folder.style.setProperty('--hf-radius', `${radius}px`);
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

  function init() {
    applyFolderColors();
    observeSidebar();
    observePrefs();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }
})();
