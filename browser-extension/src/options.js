/* global chrome */

const DEFAULTS = {
  wpBaseUrl: "",
  wpUser: "",
  wpAppPassword: "",
  updateExisting: true,
  downloadImages: true,
  showCardButtons: true,
  maxPageItems: 20,
  uiMode: "light"
};

function normalizeBaseUrl(url) {
  url = (url || "").trim();
  return url.replace(/\/+$/, "");
}

function b64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function load() {
  const [syncVals, localVals] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.storage.local.get(DEFAULTS)
  ]);
  const s = { ...DEFAULTS, ...syncVals, ...localVals };
  applyTheme(s.uiMode || "light");
  document.getElementById("wpBaseUrl").value = s.wpBaseUrl || DEFAULTS.wpBaseUrl;
  document.getElementById("wpUser").value = s.wpUser || "";
  document.getElementById("wpAppPassword").value = s.wpAppPassword || "";
  document.getElementById("updateExisting").checked = !!s.updateExisting;
  document.getElementById("downloadImages").checked = !!s.downloadImages;
  if (document.getElementById("showCardButtons")) {
    document.getElementById("showCardButtons").checked = s.showCardButtons !== false;
  }
  document.getElementById("maxPageItems").value = String(s.maxPageItems ?? DEFAULTS.maxPageItems);
}

async function save() {
  const s = {
    wpBaseUrl: normalizeBaseUrl(document.getElementById("wpBaseUrl").value),
    wpUser: document.getElementById("wpUser").value.trim(),
    wpAppPassword: document.getElementById("wpAppPassword").value.trim(),
    updateExisting: document.getElementById("updateExisting").checked,
    downloadImages: document.getElementById("downloadImages").checked,
    showCardButtons: document.getElementById("showCardButtons")
      ? document.getElementById("showCardButtons").checked
      : DEFAULTS.showCardButtons,
    maxPageItems: Number(document.getElementById("maxPageItems").value) || DEFAULTS.maxPageItems,
    uiMode: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  };
  await Promise.all([
    chrome.storage.sync.set(s),
    chrome.storage.local.set(s)
  ]);
  setStatus("Saved.");
}

function applyTheme(mode) {
  const theme = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "Light" : "Dark";
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
  setTimeout(() => {
    if (document.getElementById("status").textContent === msg) {
      document.getElementById("status").textContent = "";
    }
  }, 4000);
}

async function testConnection() {
  const wpBaseUrl = normalizeBaseUrl(document.getElementById("wpBaseUrl").value);
  const wpUser = document.getElementById("wpUser").value.trim();
  const wpAppPassword = document.getElementById("wpAppPassword").value.trim();
  if (!wpBaseUrl || !wpUser || !wpAppPassword) {
    setStatus("Set Base URL, Username, and Application Password first.");
    return;
  }

  // Hit a WP REST endpoint that requires auth and capability. We'll use /wp-json/wp/v2/users/me
  // which returns 401 if auth is wrong.
  try {
    const res = await chrome.runtime.sendMessage({
      cmd: "test_wp_auth",
      wpBaseUrl,
      wpUser,
      wpAppPassword
    });
    if (!res?.ok) {
      setStatus(`Failed: ${res?.error || "Unknown error"}`);
      return;
    }
    await save();
    setStatus(`OK: authenticated as ${res.user || "user"}. Credentials saved.`);
  } catch (e) {
    setStatus(`Error: ${String(e?.message || e)}`);
  }
}

document.getElementById("saveBtn").addEventListener("click", save);
document.getElementById("testBtn").addEventListener("click", testConnection);
document.getElementById("themeToggle").addEventListener("click", async () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    await save();
  } catch {
    // ignore
  }
});
load();
