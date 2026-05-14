/* global chrome */

const DEFAULTS = {
  wpBaseUrl: "",
  wpUser: "",
  wpAppPassword: "",
  updateExisting: true,
  downloadImages: true,
  showCardButtons: true,
  maxPageItems: 20,
  defaultCategoryId: 0,
  askCategoryBeforeImport: true,
  authPassed: false,
  cachedCategories: [],
  uiMode: "light"
};

function normalizeBaseUrl(url) {
  url = (url || "").trim();
  return url.replace(/\/+$/, "");
}

function qs(id) {
  return document.getElementById(id);
}

function toPositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function setStatus(msg) {
  qs("status").textContent = msg || "";
}

function setCatStatus(msg) {
  qs("catStatus").textContent = msg || "";
}

function applyTheme(mode) {
  const theme = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  const toggle = qs("themeToggle");
  if (toggle) {
    toggle.textContent = theme === "dark" ? "Light" : "Dark";
  }
}

function readCredsFromForm() {
  return {
    wpBaseUrl: normalizeBaseUrl(qs("wpBaseUrl").value),
    wpUser: qs("wpUser").value.trim(),
    wpAppPassword: qs("wpAppPassword").value.trim()
  };
}

function hasCreds(creds) {
  return !!(creds.wpBaseUrl && creds.wpUser && creds.wpAppPassword);
}

function setConfigCollapsed(collapsed) {
  const body = qs("configBody");
  const toggle = qs("configToggle");
  if (collapsed) {
    body.classList.add("is-collapsed");
    toggle.setAttribute("aria-expanded", "false");
  } else {
    body.classList.remove("is-collapsed");
    toggle.setAttribute("aria-expanded", "true");
  }
}

function renderCategoryOptions(categories, selectedId) {
  const select = qs("defaultCategoryId");
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select category...";
  select.appendChild(placeholder);

  for (const c of categories) {
    const id = toPositiveInt(c?.id);
    if (!id) continue;
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = String(c?.path || c?.name || `Category #${id}`);
    select.appendChild(opt);
  }

  if (toPositiveInt(selectedId) > 0) {
    select.value = String(toPositiveInt(selectedId));
  }
}

async function fetchCategoriesFromWp(creds = null) {
  setCatStatus("Loading categories...");
  const payload = { cmd: "fetch_wp_categories" };
  if (creds) {
    payload.wpBaseUrl = creds.wpBaseUrl;
    payload.wpUser = creds.wpUser;
    payload.wpAppPassword = creds.wpAppPassword;
  }
  const res = await chrome.runtime.sendMessage(payload);
  if (!res?.ok) {
    throw new Error(res?.error || "Failed to load categories.");
  }
  const categories = Array.isArray(res.categories) ? res.categories : [];
  setCatStatus(categories.length ? `Loaded ${categories.length} categories.` : "No categories found.");
  return categories;
}

async function load() {
  const [syncVals, localVals] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.storage.local.get(DEFAULTS)
  ]);
  const s = { ...DEFAULTS, ...syncVals, ...localVals };
  applyTheme(s.uiMode || "light");
  qs("wpBaseUrl").value = s.wpBaseUrl || DEFAULTS.wpBaseUrl;
  qs("wpUser").value = s.wpUser || "";
  qs("wpAppPassword").value = s.wpAppPassword || "";
  qs("askCategoryBeforeImport").checked = s.askCategoryBeforeImport !== false;

  // First run: expanded. After first successful auth: collapsed by default.
  setConfigCollapsed(!!s.authPassed);

  const selectedCategoryId = toPositiveInt(s.defaultCategoryId);
  const cached = Array.isArray(s.cachedCategories) ? s.cachedCategories : [];
  renderCategoryOptions(cached, selectedCategoryId);
  if (s.wpBaseUrl && s.wpUser && s.wpAppPassword) {
    try {
      const categories = await fetchCategoriesFromWp({
        wpBaseUrl: normalizeBaseUrl(s.wpBaseUrl),
        wpUser: String(s.wpUser || "").trim(),
        wpAppPassword: String(s.wpAppPassword || "").trim()
      });
      renderCategoryOptions(categories, selectedCategoryId);
      await save({ cachedCategories: categories });
    } catch (e) {
      setCatStatus(`Categories unavailable: ${String(e?.message || e)}`);
    }
  } else {
    setCatStatus("Enter credentials to load categories.");
  }
}

async function save(extra = {}) {
  const [syncVals, localVals] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.storage.local.get(DEFAULTS)
  ]);
  const s = { ...DEFAULTS, ...syncVals, ...localVals };
  const out = {
    ...s,
    wpBaseUrl: normalizeBaseUrl(qs("wpBaseUrl").value),
    wpUser: qs("wpUser").value.trim(),
    wpAppPassword: qs("wpAppPassword").value.trim(),
    uiMode: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
    defaultCategoryId: toPositiveInt(qs("defaultCategoryId").value),
    askCategoryBeforeImport: qs("askCategoryBeforeImport").checked,
    ...extra
  };
  await Promise.all([
    chrome.storage.sync.set(out),
    chrome.storage.local.set(out)
  ]);
}

let autoFetchTimer = null;
let autoFetchSeq = 0;

function scheduleAutoSaveAndFetch() {
  if (autoFetchTimer) clearTimeout(autoFetchTimer);
  autoFetchTimer = setTimeout(async () => {
    const seq = ++autoFetchSeq;
    try {
      await save();
      const creds = readCredsFromForm();
      if (!hasCreds(creds)) {
        renderCategoryOptions([], 0);
        setCatStatus("Enter credentials to load categories.");
        return;
      }
      const categories = await fetchCategoriesFromWp(creds);
      if (seq !== autoFetchSeq) return;
      const selected = toPositiveInt(qs("defaultCategoryId").value);
      renderCategoryOptions(categories, selected);
      await save({ authPassed: true, cachedCategories: categories });
    } catch (e) {
      if (seq !== autoFetchSeq) return;
      setCatStatus(`Categories unavailable: ${String(e?.message || e)}`);
    }
  }, 450);
}

async function testConnection() {
  const wpBaseUrl = normalizeBaseUrl(qs("wpBaseUrl").value);
  const wpUser = qs("wpUser").value.trim();
  const wpAppPassword = qs("wpAppPassword").value.trim();
  if (!wpBaseUrl || !wpUser || !wpAppPassword) {
    setStatus("Set Site URL, Username, and App Password first.");
    return;
  }

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

  setStatus(`OK: ${res.user || "user"}`);
  await save({ authPassed: true });
  setConfigCollapsed(true);

  try {
    const categories = await fetchCategoriesFromWp({ wpBaseUrl, wpUser, wpAppPassword });
    renderCategoryOptions(categories, toPositiveInt(qs("defaultCategoryId").value));
    await save({ cachedCategories: categories });
  } catch (e) {
    setCatStatus(`Categories unavailable: ${String(e?.message || e)}`);
  }
}

qs("configToggle").addEventListener("click", () => {
  const expanded = qs("configToggle").getAttribute("aria-expanded") === "true";
  setConfigCollapsed(expanded);
});

qs("themeToggle").addEventListener("click", async () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    await save({ uiMode: next });
  } catch {
    // ignore
  }
});

qs("saveBtn").addEventListener("click", async () => {
  try {
    await save();
    setStatus("Saved.");
  } catch (e) {
    setStatus(String(e?.message || e));
  }
});

qs("testBtn").addEventListener("click", async () => {
  try {
    await testConnection();
  } catch (e) {
    setStatus(String(e?.message || e));
  }
});

qs("openOptions").addEventListener("click", async (ev) => {
  ev.preventDefault();
  await chrome.runtime.openOptionsPage();
});

chrome.runtime.sendMessage({ cmd: "ensure_injected" }).catch(() => {});

for (const id of ["wpBaseUrl", "wpUser", "wpAppPassword"]) {
  qs(id).addEventListener("input", scheduleAutoSaveAndFetch);
  qs(id).addEventListener("change", scheduleAutoSaveAndFetch);
}

qs("defaultCategoryId").addEventListener("change", async () => {
  try {
    await save();
  } catch {
    // ignore
  }
});

qs("askCategoryBeforeImport").addEventListener("change", async () => {
  try {
    await save();
  } catch {
    // ignore
  }
});

load();
