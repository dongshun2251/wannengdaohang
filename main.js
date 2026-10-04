/* 网站中转站前端逻辑 */
const STORAGE_KEY = "jump_config";
const LOGIN_STORAGE_KEY = "admin_is_login";
const HAS_EDIT_STORAGE_KEY = "jump_has_edit";
const FAVORITES_KEY = "jump_favorites";
const VISITS_KEY = "jump_visits";
const LINK_STATUS_KEY = "jump_link_status";
const CONFIG_VERSIONS_KEY = "jump_config_versions";
const THEME_MODE_KEY = "jump_theme_mode";
const STATUS_NOTIFICATION_MODE_KEY = "jump_status_notification_mode";
const MAX_CONFIG_VERSIONS = 20;
const PASSWORD_HASH_ITERATIONS = 310000;
const SITE_STATUS_REFRESH_INTERVAL = 30_000;
const THEME_LIST = ["", "mint", "pink", "cyan", "indigo", "slate"];
const THEME_MODES = ["system", "light", "dark"];
const CONFIG_KEYS = [
  "openNewTab", "theme", "lastSelectSiteId", "repoUrl",
  "adminPwd", "adminPwdHash", "adminPwdSalt", "adminPwdIterations",
  "domainConfig", "embeddedPages"
];
const DEFAULT_CONFIG = {
  openNewTab: true,
  theme: "",
  lastSelectSiteId: "",
  repoUrl: "",
  adminPwdHash: "",
  adminPwdSalt: "",
  adminPwdIterations: PASSWORD_HASH_ITERATIONS,
  domainConfig: [],
  embeddedPages: []
};

let onlineConfig = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
let tempConfig = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
let onlineConfigLoaded = false;
let currentSite = null;
let isAdminLogin = localStorage.getItem(LOGIN_STORAGE_KEY) === "1";
let hasLocalEdit = localStorage.getItem(HAS_EDIT_STORAGE_KEY) === "1";
let themeMode = THEME_MODES.includes(localStorage.getItem(THEME_MODE_KEY))
  ? localStorage.getItem(THEME_MODE_KEY)
  : "system";
const urlParams = window.location.search;

const $ = id => document.getElementById(id);
const DOM = {
  toastContainer: $("toastContainer"),
  themeSwitchBtn: $("themeSwitchBtn"),
  themePopover: $("themePopover"),
  sourceTip: $("sourceTip"),
  homeDomainWrap: $("homeDomainWrap"),
  loginSection: $("loginSection"),
  adminPwdInput: $("adminPwdInput"),
  loginBtn: $("loginBtn"),
  sitesContent: $("sitesContent"),
  configContent: $("configContent"),
  configLoginHint: $("configLoginHint"),
  newPwdInput: $("newPwdInput"),
  globalNewTabSwitch: $("globalNewTabSwitch"),
  siteNameInput: $("siteNameInput"),
  siteUrlInput: $("siteUrlInput"),
  siteIconInput: $("siteIconInput"),
  siteCategoryInput: $("siteCategoryInput"),
  siteDescriptionInput: $("siteDescriptionInput"),
  siteWeightInput: $("siteWeightInput"),
  addSiteBtn: $("addSiteBtn"),
  adminDomainWrap: $("adminDomainWrap"),
  editSection: $("editSection"),
  editCloseBtn: $("editCloseBtn"),
  editSiteId: $("editSiteId"),
  editNameInput: $("editNameInput"),
  editUrlInput: $("editUrlInput"),
  editIconInput: $("editIconInput"),
  editCategoryInput: $("editCategoryInput"),
  editDescriptionInput: $("editDescriptionInput"),
  editWeightInput: $("editWeightInput"),
  editOpenCheck: $("editOpenCheck"),
  editSaveBtn: $("editSaveBtn"),
  embNameInput: $("embNameInput"),
  embUrlInput: $("embUrlInput"),
  addEmbBtn: $("addEmbBtn"),
  embWrap: $("embWrap"),
  jsonPreview: $("jsonPreview"),
  editsBadge: $("editsBadge"),
  addSaveExportBtn: $("addSaveExportBtn"),
  addSaveExportBtn2: $("addSaveExportBtn2"),
  repoQuickLink: $("repoQuickLink"),
  logoutBtn: $("logoutBtn"),
  siteSearchInput: $("siteSearchInput"),
  siteCategoryFilter: $("siteCategoryFilter"),
  favoritesOnly: $("favoritesOnly"),
  recentOnlyBtn: $("recentOnlyBtn"),
  siteSummary: $("siteSummary"),
  statusNotificationMode: $("statusNotificationMode"),
  backupConfigBtn: $("backupConfigBtn"),
  restoreConfigBtn: $("restoreConfigBtn"),
  restoreConfigFile: $("restoreConfigFile"),
  checkAllSitesBtn: $("checkAllSitesBtn"),
  visitStats: $("visitStats"),
  configVersions: $("configVersions"),
  selectAllSites: $("selectAllSites"),
  selectedSiteCount: $("selectedSiteCount"),
  bulkCategoryEnabled: $("bulkCategoryEnabled"),
  bulkCategoryInput: $("bulkCategoryInput"),
  bulkOpenState: $("bulkOpenState"),
  applyBulkEditBtn: $("applyBulkEditBtn"),
  bulkSiteInput: $("bulkSiteInput"),
  bulkImportSitesBtn: $("bulkImportSitesBtn")
};
let showRecentOnly = false;
const selectedSiteIds = new Set();
let statusNotificationMode = ["sequential", "summary"].includes(localStorage.getItem(STATUS_NOTIFICATION_MODE_KEY))
  ? localStorage.getItem(STATUS_NOTIFICATION_MODE_KEY)
  : "sequential";
DOM.statusNotificationMode.value = statusNotificationMode;
DOM.statusNotificationMode.addEventListener("change", () => {
  statusNotificationMode = DOM.statusNotificationMode.value === "summary" ? "summary" : "sequential";
  localStorage.setItem(STATUS_NOTIFICATION_MODE_KEY, statusNotificationMode);
});

// ==================== Tab切换 ====================
let currentTab = localStorage.getItem("lastTab") || "jump";
function switchTab(tabName) {
  const validTabs = ["jump", "sites", "config", "json"];
  if (!validTabs.includes(tabName) || (tabName === "json" && !isAdminLogin)) {
    tabName = "jump";
  }
  currentTab = tabName;
  localStorage.setItem("lastTab", tabName);
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `panel-${tabName}`);
  });
  if (tabName === "config" && !isAdminLogin) {
    DOM.configContent.style.display = "none";
    DOM.configLoginHint.style.display = "block";
  }
  // 新增：切换站点管理页自动渲染仓库
  if (tabName === "sites" && isAdminLogin) {
    renderEmbList();
  }
}
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ==================== 工具函数 ====================
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, char => map[char]);
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function toBase64(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
function fromBase64(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
async function derivePasswordHash(password, salt, iterations = PASSWORD_HASH_ITERATIONS) {
  if (!window.crypto?.subtle) {
    throw new Error("当前环境不支持安全密码哈希，请通过 HTTPS 托管网站后重试");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations,
    hash: "SHA-256"
  }, keyMaterial, 256);
  return new Uint8Array(bits);
}
async function hashAdminPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return {
    adminPwdHash: toBase64(hash),
    adminPwdSalt: toBase64(salt),
    adminPwdIterations: PASSWORD_HASH_ITERATIONS
  };
}
async function verifyAdminPassword(password, config) {
  if (config.adminPwdHash || config.adminPwdSalt) {
    if (!config.adminPwdHash || !config.adminPwdSalt) return false;
    const iterations = Number(config.adminPwdIterations);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
    try {
      const expected = fromBase64(config.adminPwdHash);
      const actual = await derivePasswordHash(password, fromBase64(config.adminPwdSalt), iterations);
      if (expected.length !== actual.length) return false;
      let difference = 0;
      for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i];
      return difference === 0;
    } catch (err) {
      throw new Error("密码哈希配置无效或当前浏览器不支持安全校验");
    }
  }
  return typeof config.adminPwd === "string" && password === config.adminPwd;
}
function configForExport(config) {
  const sanitized = deepClone(config);
  delete sanitized.adminPwd;
  if (!sanitized.adminPwdHash && onlineConfig.adminPwdHash) {
    sanitized.adminPwdHash = onlineConfig.adminPwdHash;
    sanitized.adminPwdSalt = onlineConfig.adminPwdSalt;
    sanitized.adminPwdIterations = onlineConfig.adminPwdIterations;
  }
  return sanitized;
}
function scrubLegacyPasswordSnapshots() {
  const versions = readLocalJson(CONFIG_VERSIONS_KEY, []);
  if (!Array.isArray(versions)) return;
  let changed = false;
  versions.forEach(version => {
    try {
      const snapshot = JSON.parse(version.snapshot);
      if (Object.prototype.hasOwnProperty.call(snapshot, "adminPwd")) {
        delete snapshot.adminPwd;
        if (onlineConfig.adminPwdHash) {
          snapshot.adminPwdHash = onlineConfig.adminPwdHash;
          snapshot.adminPwdSalt = onlineConfig.adminPwdSalt;
          snapshot.adminPwdIterations = onlineConfig.adminPwdIterations;
        }
        version.snapshot = JSON.stringify(snapshot);
        changed = true;
      }
    } catch (err) {
      // Preserve unreadable history entries; they cannot be restored by the UI.
    }
  });
  if (changed) writeLocalJson(CONFIG_VERSIONS_KEY, versions);
}
function isValidConfig(config) {
  const hasPasswordHash = Boolean(config?.adminPwdHash || config?.adminPwdSalt);
  const iterations = Number(config?.adminPwdIterations);
  const validPasswordHash = !hasPasswordHash ||
    (typeof config.adminPwdHash === "string" && typeof config.adminPwdSalt === "string" &&
      Number.isInteger(iterations) && iterations >= 100000 && iterations <= 1000000);
  return config && typeof config === "object" && !Array.isArray(config) &&
    validPasswordHash &&
    Array.isArray(config.domainConfig) &&
    config.domainConfig.every(site => site && typeof site === "object" &&
      typeof site.name === "string" && validHttpUrl(site.url)) &&
    (config.embeddedPages === undefined || Array.isArray(config.embeddedPages)) &&
    (!Array.isArray(config.embeddedPages) || config.embeddedPages.every(repo =>
      repo && typeof repo.name === "string" && validHttpUrl(repo.url)));
}
function normalizeConfig(config) {
  const normalized = { ...DEFAULT_CONFIG, ...config };
  if (!THEME_LIST.includes(normalized.theme)) normalized.theme = "";
  delete normalized.waitSecond;
  if (normalized.adminPwdHash) delete normalized.adminPwd;
  const usedIds = new Set();
  normalized.domainConfig = normalized.domainConfig.map(site => {
    const siteData = { ...site };
    delete siteData.videoUrl;
    return {
      ...siteData,
      id: normalizeSiteId(site.id, usedIds),
      icon: String(site.icon || ""),
      category: String(site.category || ""),
      description: String(site.description || ""),
      weight: parseWeight(site.weight),
      open: Boolean(site.open)
    };
  });
  normalized.embeddedPages = (normalized.embeddedPages || []).map(repo => ({
    ...repo,
    id: String(repo.id || genUniqueId("repo"))
  }));
  return normalized;
}
function normalizeSiteId(value, usedIds) {
  const candidate = String(value || "");
  const id = /^[A-Za-z0-9_-]+$/.test(candidate) && !usedIds.has(candidate)
    ? candidate
    : genUniqueId("site");
  usedIds.add(id);
  return id;
}
function hasLegacyVideoSettings(config) {
  return Array.isArray(config?.domainConfig) && config.domainConfig.some(site =>
    site && typeof site === "object" && Object.prototype.hasOwnProperty.call(site, "videoUrl")
  );
}
function parseWeight(value) {
  if (String(value).trim() === "") return 1;
  const weight = Number(value);
  return Number.isFinite(weight) && weight >= 0 ? weight : 1;
}
function validHttpUrl(url) {
  try {
    const parsedUrl = new URL(String(url).trim());
    return ["http:", "https:"].includes(parsedUrl.protocol) && Boolean(parsedUrl.hostname);
  } catch (err) {
    return false;
  }
}
function isFaviconServiceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.origin === "https://www.google.com" && url.pathname === "/s2/favicons/";
  } catch (err) {
    return false;
  }
}
function siteIconMarkup(icon) {
  const value = String(icon || "").trim();
  if (validHttpUrl(value)) {
    return `<img class="site-icon-image" src="${escapeHtml(value)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return escapeHtml(value || "🌐");
}
function siteFaviconUrl(siteUrl) {
  if (!validHttpUrl(siteUrl)) return "";
  return new URL("/favicon.ico", siteUrl).toString();
}
function attachSiteIconFallbacks(container, siteUrl) {
  const fallbackUrl = siteFaviconUrl(siteUrl);
  container.querySelectorAll(".site-icon-image").forEach(img => {
    img.addEventListener("error", () => {
      if (fallbackUrl && img.dataset.fallbackAttempted !== "true" && img.src !== fallbackUrl) {
        img.dataset.fallbackAttempted = "true";
        img.src = fallbackUrl;
        return;
      }
      img.replaceWith(document.createTextNode("🌐"));
    });
  });
}
function getFaviconUrl(url) {
  const faviconUrl = new URL("https://www.google.com/s2/favicons/");
  faviconUrl.searchParams.set("domain_url", url);
  faviconUrl.searchParams.set("sz", "64");
  return faviconUrl.toString();
}
function ensureAutoFavicon(url, iconInput) {
  if (iconInput.dataset.autoDetected === "true" || !iconInput.value.trim()) {
    if (validHttpUrl(url)) {
      iconInput.value = getFaviconUrl(url);
      iconInput.dataset.autoDetected = "true";
    }
  }
  return iconInput.value.trim();
}
function enableFaviconAutodetect(urlInput, iconInput) {
  let timer;
  urlInput.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const url = urlInput.value.trim();
      if (!url) {
        if (iconInput.dataset.autoDetected === "true") {
          iconInput.value = "";
          iconInput.dataset.autoDetected = "false";
        }
        return;
      }
      if (iconInput.dataset.autoDetected !== "true" && iconInput.value.trim()) return;
      if (!validHttpUrl(url)) return;
      if (urlInput.value.trim() !== url) return;
      ensureAutoFavicon(url, iconInput);
    }, 500);
  });
  iconInput.addEventListener("input", () => {
    iconInput.dataset.autoDetected = "false";
  });
}
enableFaviconAutodetect(DOM.siteUrlInput, DOM.siteIconInput);
enableFaviconAutodetect(DOM.editUrlInput, DOM.editIconInput);
function urlExistInList(url, excludeId = "") {
  return tempConfig.domainConfig.some(item => item.url === url && item.id !== excludeId);
}
function genUniqueId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function readLocalJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    showToast("读取本机浏览器数据失败", "warning");
    return fallback;
  }
}
function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    showToast("浏览器本机存储失败，可能空间不足", "error", 4000);
    return false;
  }
}
function getFavorites() {
  const favorites = readLocalJson(FAVORITES_KEY, []);
  return Array.isArray(favorites) ? favorites : [];
}
function getVisits() {
  const visits = readLocalJson(VISITS_KEY, {});
  return visits && typeof visits === "object" && !Array.isArray(visits) ? visits : {};
}
function getLinkStatuses() {
  const statuses = readLocalJson(LINK_STATUS_KEY, {});
  return statuses && typeof statuses === "object" && !Array.isArray(statuses) ? statuses : {};
}
function sortedSites(sites) {
  return [...sites].sort((a, b) =>
    (Number(a.weight) || 0) - (Number(b.weight) || 0) ||
    String(a.name).localeCompare(String(b.name), "zh-CN"));
}
function getFirstOpenSite() {
  const openList = onlineConfig.domainConfig.filter(item => item.open);
  if (openList.length === 0) return null;
  openList.sort((a, b) => (Number(a.weight) || 0) - (Number(b.weight) || 0));
  return openList[0];
}

// ==================== Toast弹窗 ====================
function showToast(message, type = "info", duration = 3000) {
  if (!DOM.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;
  toast.style.setProperty("--toast-duration", `${duration}ms`);
  toast.textContent = message;
  toast.addEventListener("click", () => removeToast(toast));
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => removeToast(toast), duration);
}
function showToastSequence(notifications, duration = 10_000) {
  if (!DOM.toastContainer) return;
  const fadeDuration = 250;
  notifications.forEach(({ message, type }, index) => {
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    toast.style.setProperty("--toast-duration", `${duration}ms`);
    toast.style.setProperty("--toast-delay", `${index * (duration + fadeDuration)}ms`);
    toast.textContent = message;
    toast.addEventListener("click", () => removeToast(toast));
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => removeToast(toast), index * (duration + fadeDuration) + duration);
  });
}
function removeToast(el) {
  if (!el.parentNode) return;
  if (el.classList.contains("toast-out")) return;
  el.classList.add("toast-out");
  setTimeout(() => el.remove(), 250);
}

// ==================== 确认弹窗 ====================
function showConfirm(title, content) {
  return new Promise(resolve => {
    const mask = document.createElement("div");
    mask.className = "confirm-overlay";
    mask.innerHTML = `
            <div class="confirm-box">
                <div class="confirm-title">${escapeHtml(title)}</div>
                <div class="confirm-content">${escapeHtml(content)}</div>
                <div class="confirm-btn-row">
                    <button class="btn-cancel">取消</button>
                    <button class="btn-ok">确认</button>
                </div>
            </div>
        `;
    document.body.appendChild(mask);
    const close = (result) => {
      mask.remove();
      resolve(result);
    };
    mask.querySelector(".btn-cancel").addEventListener("click", () => close(false));
    mask.querySelector(".btn-ok").addEventListener("click", () => close(true));
    mask.addEventListener("click", e => {
      if (e.target === mask) close(false);
    });
    const escHandler = e => {
      if (e.key === "Escape") {
        close(false);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  });
}

// ==================== 主题设置 ====================
function updateThemePopover() {
  DOM.themeSwitchBtn.setAttribute("aria-expanded", String(!DOM.themePopover.hidden));
  document.querySelectorAll(".theme-mode-btn").forEach(button => {
    button.classList.toggle("selected", button.dataset.mode === themeMode);
  });
  document.querySelectorAll(".theme-color-btn").forEach(button => {
    const selected = button.dataset.theme === (onlineConfig.theme || "");
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}
function setThemeMode(mode) {
  if (!THEME_MODES.includes(mode)) return;
  themeMode = mode;
  localStorage.setItem(THEME_MODE_KEY, mode);
  applySavedTheme();
  updateThemePopover();
}
function setAccentTheme(theme) {
  if (!THEME_LIST.includes(theme)) return;
  recordConfigVersion(onlineConfig, "切换强调色前自动备份");
  onlineConfig.theme = theme;
  tempConfig.theme = theme;
  saveLocalConfig();
  localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
  hasLocalEdit = true;
  applySavedTheme();
  updateJsonPreview();
  updateEditBadge();
  renderConfigVersions();
  updateThemePopover();
}
DOM.themeSwitchBtn.addEventListener("click", () => {
  DOM.themePopover.hidden = !DOM.themePopover.hidden;
  updateThemePopover();
});
document.querySelectorAll(".theme-mode-btn").forEach(button => {
  button.addEventListener("click", () => setThemeMode(button.dataset.mode));
});
document.querySelectorAll(".theme-color-btn").forEach(button => {
  button.addEventListener("click", () => setAccentTheme(button.dataset.theme));
});
document.addEventListener("click", event => {
  if (!event.target.closest(".theme-control")) {
    DOM.themePopover.hidden = true;
    updateThemePopover();
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !DOM.themePopover.hidden) {
    DOM.themePopover.hidden = true;
    updateThemePopover();
    DOM.themeSwitchBtn.focus();
  }
});
function applySavedTheme() {
  document.documentElement.setAttribute("data-theme", onlineConfig.theme || "");
  const appliedMode = themeMode === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : themeMode;
  document.documentElement.setAttribute("data-color-mode", appliedMode);
  updateThemePopover();
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeMode === "system") applySavedTheme();
});

// ==================== 本地存储读写 ====================
function saveLocalConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(onlineConfig));
    return true;
  } catch (err) {
    showToast("配置未能保存到本机浏览器存储", "error", 5000);
    return false;
  }
}
function loadLocalConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    CONFIG_KEYS.forEach(key => {
      if (cfg[key] !== undefined) onlineConfig[key] = cfg[key];
    });
    // 兜底：旧配置无仓库数组则强制赋值空数组
    if (!onlineConfig.embeddedPages) onlineConfig.embeddedPages = [];
  } catch (err) { }
}

// ==================== 临时配置自动保存 ====================
function autoSaveTemp() {
  recordConfigVersion(onlineConfig, "修改前自动备份");
  onlineConfig = deepClone(tempConfig);
  syncCurrentSite();
  saveLocalConfig();
  localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
  hasLocalEdit = true;
  renderHomeDomainList();
  updateJsonPreview();
  updateEditBadge();
  renderVisitStats();
  renderConfigVersions();
}
function recordConfigVersion(config, label = "自动备份") {
  if (!config || !Array.isArray(config.domainConfig)) return;
  const versions = readLocalJson(CONFIG_VERSIONS_KEY, []);
  if (!Array.isArray(versions)) return;
  const safeConfig = configForExport(config);
  const snapshot = JSON.stringify(safeConfig);
  if (versions[0]?.snapshot === snapshot) return;
  versions.unshift({ id: genUniqueId("version"), label, createdAt: Date.now(), snapshot });
  writeLocalJson(CONFIG_VERSIONS_KEY, versions.slice(0, MAX_CONFIG_VERSIONS));
}
function renderConfigVersions() {
  if (!DOM.configVersions) return;
  const versions = readLocalJson(CONFIG_VERSIONS_KEY, []);
  DOM.configVersions.replaceChildren();
  if (!Array.isArray(versions) || versions.length === 0) {
    DOM.configVersions.innerHTML = '<div class="domain-empty">暂无本机配置版本</div>';
    return;
  }
  versions.forEach(version => {
    const row = document.createElement("div");
    row.className = "version-row";
    const date = new Date(version.createdAt).toLocaleString();
    row.innerHTML = `<span>${escapeHtml(version.label)} · ${escapeHtml(date)}</span><button class="btn btn-secondary btn-sm restore-version">恢复</button>`;
    row.querySelector(".restore-version").addEventListener("click", async () => {
      const ok = await showConfirm("恢复配置版本", `将恢复到 ${date} 的配置，当前配置会先自动备份。`);
      if (!ok) return;
      try {
        const restored = JSON.parse(version.snapshot);
        if (!isValidConfig(restored)) throw new Error("invalid config");
        recordConfigVersion(onlineConfig, "恢复前自动备份");
        onlineConfig = normalizeConfig(restored);
        tempConfig = deepClone(onlineConfig);
        saveLocalConfig();
        localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
        hasLocalEdit = true;
        renderAll();
        renderAdminDomainList();
        renderEmbList();
        applySavedTheme();
        updateJsonPreview();
        autoSelectDefaultSite();
        showToast("配置版本已恢复到本机", "success");
        updateEditBadge();
        renderConfigVersions();
      } catch (err) {
        showToast("该配置版本无法读取", "error");
      }
    });
    DOM.configVersions.appendChild(row);
  });
}
function downloadConfigBackup() {
  const contents = JSON.stringify(configForExport(tempConfig), null, 2);
  const blobUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `website-config-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  showToast("本机配置备份已下载", "success");
}
DOM.backupConfigBtn.addEventListener("click", downloadConfigBackup);
DOM.restoreConfigBtn.addEventListener("click", () => DOM.restoreConfigFile.click());
DOM.restoreConfigFile.addEventListener("change", async () => {
  const file = DOM.restoreConfigFile.files?.[0];
  DOM.restoreConfigFile.value = "";
  if (!file) return;
  let imported;
  try {
    imported = JSON.parse(await file.text());
  } catch (err) {
    showToast("无法读取备份文件，请确认它是有效的 JSON", "error", 5000);
    return;
  }
  if (!isValidConfig(imported)) {
    showToast("备份文件格式无效，当前配置未更改", "error", 5000);
    return;
  }
  const ok = await showConfirm("从备份恢复", "当前配置会先保存到本机版本记录，再由备份覆盖。继续吗？");
  if (!ok) return;
  const previousConfig = onlineConfig;
  const previousTempConfig = tempConfig;
  const restored = normalizeConfig(imported);
  if (!restored.adminPwdHash && !restored.adminPwd) {
    restored.adminPwdHash = onlineConfig.adminPwdHash;
    restored.adminPwdSalt = onlineConfig.adminPwdSalt;
    restored.adminPwdIterations = onlineConfig.adminPwdIterations;
  }
  if (restored.adminPwd) {
    try {
      Object.assign(restored, await hashAdminPassword(restored.adminPwd));
      delete restored.adminPwd;
    } catch (err) {
      showToast(err.message, "error", 5000);
      return;
    }
  }
  recordConfigVersion(onlineConfig, "手动恢复前备份");
  onlineConfig = restored;
  tempConfig = deepClone(restored);
  if (!saveLocalConfig()) {
    onlineConfig = previousConfig;
    tempConfig = previousTempConfig;
    return;
  }
  localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
  hasLocalEdit = true;
  currentSite = null;
  selectedSiteIds.clear();
  renderAll();
  renderAdminDomainList();
  renderEmbList();
  applySavedTheme();
  updateJsonPreview();
  updateEditBadge();
  renderVisitStats();
  renderConfigVersions();
  autoSelectDefaultSite();
  showToast("备份已恢复到本机；需要复制 JSON 并手动发布到仓库", "success", 5000);
});
function updateEditBadge() {
  if (!DOM.editsBadge) return;
  DOM.editsBadge.style.display = (hasLocalEdit && isAdminLogin) ? "inline-block" : "none";
}

// ==================== 页面初始化加载 ====================
async function loadAllConfig() {
  loadLocalConfig();
  hasLocalEdit = localStorage.getItem(HAS_EDIT_STORAGE_KEY) === "1";
  let removedLegacyVideoSettings = hasLegacyVideoSettings(onlineConfig);
  let removedLegacyAccent = ["ruby", "purple", "coral", "deepblue", "amber", "lime"].includes(onlineConfig.theme);
  if (!hasLocalEdit) {
    try {
      const res = await fetch(`config.json?t=${Date.now()}`);
      if (!res.ok) throw new Error("no config");
      const remoteCfg = await res.json();
      removedLegacyVideoSettings = removedLegacyVideoSettings || hasLegacyVideoSettings(remoteCfg);
      removedLegacyAccent = removedLegacyAccent || ["ruby", "purple", "coral", "deepblue", "amber", "lime"].includes(remoteCfg.theme);
      const fullCfg = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
      CONFIG_KEYS.forEach(k => {
        if (remoteCfg[k] !== undefined) fullCfg[k] = remoteCfg[k];
      });
      onlineConfig = normalizeConfig(fullCfg);
      saveLocalConfig();
    } catch (err) {
      showToast("加载线上配置失败，使用本地缓存", "warning", 4000);
    }
  } else {
    showToast("已恢复上次编辑状态", "info", 2000);
  }
  if (!isValidConfig(onlineConfig)) {
    showToast("配置格式无效，已使用默认配置", "error", 4000);
    onlineConfig = deepClone(DEFAULT_CONFIG);
  } else {
    onlineConfig = normalizeConfig(onlineConfig);
  }
  if (removedLegacyVideoSettings) {
    saveLocalConfig();
    localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
    hasLocalEdit = true;
    showToast("已从旧配置移除视频字段；请复制更新后的 JSON 并发布到仓库", "info", 5000);
  }
  if (removedLegacyAccent) {
    saveLocalConfig();
    localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
    hasLocalEdit = true;
    showToast("已将旧版主题重置为默认青绿色；请复制更新后的 JSON 并发布", "info", 5000);
  }
  if (onlineConfig.adminPwd && !onlineConfig.adminPwdHash) {
    try {
      Object.assign(onlineConfig, await hashAdminPassword(onlineConfig.adminPwd));
      delete onlineConfig.adminPwd;
      saveLocalConfig();
      localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
      hasLocalEdit = true;
      scrubLegacyPasswordSnapshots();
      showToast("旧版明文密码已在本机转换为哈希；请复制更新后的 JSON 并发布", "warning", 5000);
    } catch (err) {
      showToast(err.message, "error", 5000);
    }
  } else if (onlineConfig.adminPwdHash) {
    scrubLegacyPasswordSnapshots();
  }
  onlineConfigLoaded = true;
  tempConfig = deepClone(onlineConfig);
  applySavedTheme();
  renderAll();
  autoSelectDefaultSite();
  if (isAdminLogin) renderAdminPanel();
  else {
    DOM.configContent.style.display = "none";
    DOM.configLoginHint.style.display = "block";
  }
  updateJsonPreview();
  updateEditBadge();
  switchTab(currentTab);
  const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
  if (jsonTabBtn) jsonTabBtn.style.display = isAdminLogin ? "flex" : "none";
  renderEmbList();
  renderVisitStats();
  renderConfigVersions();
  await Promise.all(tempConfig.domainConfig.map(site => checkSiteStatus(site)));
  window.setInterval(refreshSiteStatusesSilently, SITE_STATUS_REFRESH_INTERVAL);
}

// ==================== JSON预览刷新 ====================
function updateJsonPreview() {
  if (!DOM.jsonPreview) return;
  DOM.jsonPreview.textContent = JSON.stringify(configForExport(tempConfig), null, 2);
}

// ==================== 管理员登录登出 ====================
async function adminLogin() {
  const pwd = DOM.adminPwdInput.value;
  if (!pwd) return showToast("请输入管理员密码", "warning");
  let match;
  try {
    match = await verifyAdminPassword(pwd, onlineConfig);
  } catch (err) {
    showToast(err.message, "error", 5000);
    return;
  }
  if (match) {
    DOM.adminPwdInput.value = "";
    if (onlineConfig.adminPwd) {
      try {
        Object.assign(onlineConfig, await hashAdminPassword(onlineConfig.adminPwd));
        delete onlineConfig.adminPwd;
        tempConfig = deepClone(onlineConfig);
        saveLocalConfig();
        localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
        hasLocalEdit = true;
        scrubLegacyPasswordSnapshots();
        showToast("旧版密码已转换为哈希，请导出并发布新配置", "warning", 5000);
      } catch (err) {
        showToast(err.message, "error", 5000);
      }
    }
    isAdminLogin = true;
    localStorage.setItem(LOGIN_STORAGE_KEY, "1");
    renderAdminPanel();
    renderEmbList(); // 登录后强制刷新仓库
    showToast("登录成功", "success");
  } else {
    showToast("密码错误", "error");
  }
}
DOM.loginBtn.addEventListener("click", adminLogin);
DOM.adminPwdInput.addEventListener("keydown", e => {
  if (e.key === "Enter") adminLogin();
});

function renderAdminPanel() {
  DOM.loginSection.style.display = "none";
  DOM.sitesContent.style.display = "block";
  DOM.configContent.style.display = "block";
  DOM.configLoginHint.style.display = "none";
  tempConfig = deepClone(onlineConfig);
  syncConfigToForm();
  renderAdminDomainList();
  renderEmbList();
  renderVisitStats();
  renderConfigVersions();
  updateJsonPreview();
  updateEditBadge();
  const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
  if (jsonTabBtn) jsonTabBtn.style.display = "flex";
}

function adminLogout() {
  isAdminLogin = false;
  localStorage.removeItem(LOGIN_STORAGE_KEY);
  DOM.loginSection.style.display = "";
  DOM.sitesContent.style.display = "none";
  DOM.configContent.style.display = "none";
  DOM.configLoginHint.style.display = "block";
  DOM.adminPwdInput.value = "";
  showToast("已登出管理员", "info");
  updateEditBadge();
  const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
  if (jsonTabBtn) jsonTabBtn.style.display = "none";
  switchTab("jump");
}
DOM.logoutBtn.addEventListener("click", adminLogout);

// 修改管理员密码
async function changeAdminPwd() {
  const newPwd = DOM.newPwdInput.value.trim();
  if (!newPwd) {
    showToast("密码不能为空", "warning");
    return false;
  }
  let passwordHash;
  try {
    passwordHash = await hashAdminPassword(newPwd);
  } catch (err) {
    showToast(err.message, "error", 5000);
    return false;
  }
  Object.assign(tempConfig, passwordHash);
  delete tempConfig.adminPwd;
  DOM.newPwdInput.value = "";
  autoSaveTemp();
  showToast("管理员密码哈希已保存到本机配置；发布 JSON 后线上才会生效", "success", 5000);
  return true;
}
DOM.newPwdInput.addEventListener("keydown", e => {
  if (e.key === "Enter") changeAdminPwd();
});
function syncConfigToForm() {
  DOM.globalNewTabSwitch.checked = tempConfig.openNewTab;
}

// ==================== 站点管理 ====================
function addNewSite() {
  const name = DOM.siteNameInput.value.trim();
  const url = DOM.siteUrlInput.value.trim();
  const weight = parseWeight(DOM.siteWeightInput.value);
  if (!name || !url) return showToast("请填写站点名称和链接", "warning");
  if (!validHttpUrl(url)) return showToast("链接必须以http/https开头", "error");
  if (urlExistInList(url)) return showToast("该站点已存在", "warning");
  const icon = ensureAutoFavicon(url, DOM.siteIconInput);
  const newItem = {
    id: genUniqueId("site"),
    name,
    url,
    icon,
    category: DOM.siteCategoryInput.value.trim(),
    description: DOM.siteDescriptionInput.value.trim(),
    weight,
    open: false
  };
  tempConfig.domainConfig.push(newItem);
  DOM.siteNameInput.value = "";
  DOM.siteUrlInput.value = "";
  DOM.siteIconInput.value = "";
  DOM.siteIconInput.dataset.autoDetected = "false";
  DOM.siteCategoryInput.value = "";
  DOM.siteDescriptionInput.value = "";
  DOM.siteWeightInput.value = "1";
  renderAdminDomainList();
  autoSaveTemp();
  showToast("站点添加成功", "success");
}
DOM.addSiteBtn.addEventListener("click", addNewSite);

async function deleteSiteItem(id) {
  const target = tempConfig.domainConfig.find(s => s.id === id);
  if (!target) return;
  const ok = await showConfirm("删除站点", `确定删除「${target.name}」吗？`);
  if (!ok) return;
  tempConfig.domainConfig = tempConfig.domainConfig.filter(s => s.id !== id);
  selectedSiteIds.delete(id);
  DOM.selectAllSites.checked = false;
  renderAdminDomainList();
  updateBulkSelectionCount();
  autoSaveTemp();
  showToast("站点已删除", "success");
}

function openSiteEdit(item) {
  DOM.editSiteId.value = item.id;
  DOM.editNameInput.value = item.name;
  DOM.editUrlInput.value = item.url;
  DOM.editIconInput.value = item.icon || "";
  DOM.editIconInput.dataset.autoDetected = String(isFaviconServiceUrl(item.icon));
  DOM.editCategoryInput.value = item.category || "";
  DOM.editDescriptionInput.value = item.description || "";
  DOM.editWeightInput.value = item.weight || 1;
  DOM.editOpenCheck.checked = item.open;
  DOM.editSection.style.display = "block";
  DOM.editSection.scrollIntoView({ behavior: "smooth", block: "center" });
}
DOM.editCloseBtn.addEventListener("click", () => DOM.editSection.style.display = "none");

function saveEditedSite() {
  const editId = DOM.editSiteId.value;
  const name = DOM.editNameInput.value.trim();
  const url = DOM.editUrlInput.value.trim();
  const weight = parseWeight(DOM.editWeightInput.value);
  const open = DOM.editOpenCheck.checked;
  if (!name || !url) return showToast("名称和链接不能为空", "warning");
  if (!validHttpUrl(url)) return showToast("链接格式错误", "error");
  if (urlExistInList(url, editId)) return showToast("该链接已被其他站点占用", "warning");
  const target = tempConfig.domainConfig.find(s => s.id === editId);
  if (!target) return;
  const icon = ensureAutoFavicon(url, DOM.editIconInput);
  target.name = name;
  target.url = url;
  target.icon = icon;
  target.category = DOM.editCategoryInput.value.trim();
  target.description = DOM.editDescriptionInput.value.trim();
  target.weight = weight;
  target.open = open;
  DOM.editSection.style.display = "none";
  renderAdminDomainList();
  autoSaveTemp();
  showToast("站点修改完成", "success");
}
DOM.editSaveBtn.addEventListener("click", saveEditedSite);

document.addEventListener("change", e => {
  const input = e.target;
  if (!input.name?.startsWith("stat_")) return;
  const siteId = input.name.replace("stat_", "");
  const site = tempConfig.domainConfig.find(s => s.id === siteId);
  if (!site) return;
  site.open = input.value === "1";
  autoSaveTemp();
});

function updateBulkSelectionCount() {
  const validIds = new Set(tempConfig.domainConfig.map(site => site.id));
  selectedSiteIds.forEach(id => {
    if (!validIds.has(id)) selectedSiteIds.delete(id);
  });
  DOM.selectedSiteCount.textContent = `已选 ${selectedSiteIds.size} 个`;
  DOM.selectAllSites.checked = validIds.size > 0 && selectedSiteIds.size === validIds.size;
}
DOM.selectAllSites.addEventListener("change", () => {
  selectedSiteIds.clear();
  if (DOM.selectAllSites.checked) {
    tempConfig.domainConfig.forEach(site => selectedSiteIds.add(site.id));
  }
  renderAdminDomainList();
});
DOM.bulkCategoryEnabled.addEventListener("change", () => {
  DOM.bulkCategoryInput.disabled = !DOM.bulkCategoryEnabled.checked;
});
const bulkStateSelect = document.querySelector(".bulk-state-select");
const bulkStateTrigger = $("bulkOpenStateTrigger");
const bulkStateMenu = $("bulkOpenStateMenu");
const bulkStateOptions = [...bulkStateMenu.querySelectorAll(".bulk-state-option")];
function closeBulkStateMenu(restoreFocus = false) {
  bulkStateMenu.hidden = true;
  bulkStateTrigger.setAttribute("aria-expanded", "false");
  if (restoreFocus) bulkStateTrigger.focus();
}
function setBulkOpenState(value, focusTrigger = true) {
  const option = bulkStateOptions.find(button => button.dataset.value === value);
  if (!option) return;
  DOM.bulkOpenState.value = value;
  bulkStateTrigger.querySelector("span").textContent = option.textContent;
  bulkStateOptions.forEach(button => {
    const selected = button === option;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  closeBulkStateMenu(focusTrigger);
}
bulkStateTrigger.addEventListener("click", () => {
  const willOpen = bulkStateMenu.hidden;
  bulkStateMenu.hidden = !willOpen;
  bulkStateTrigger.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    (bulkStateOptions.find(button => button.dataset.value === DOM.bulkOpenState.value) || bulkStateOptions[0]).focus();
  }
});
bulkStateOptions.forEach((button, index) => {
  button.addEventListener("click", () => setBulkOpenState(button.dataset.value));
  button.addEventListener("keydown", event => {
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % bulkStateOptions.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + bulkStateOptions.length) % bulkStateOptions.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = bulkStateOptions.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeBulkStateMenu(true);
      return;
    } else if (event.key === "Tab") {
      closeBulkStateMenu();
      return;
    } else {
      return;
    }
    event.preventDefault();
    bulkStateOptions[nextIndex].focus();
  });
});
document.addEventListener("click", event => {
  if (!bulkStateSelect.contains(event.target)) closeBulkStateMenu();
});
DOM.applyBulkEditBtn.addEventListener("click", () => {
  const selected = tempConfig.domainConfig.filter(site => selectedSiteIds.has(site.id));
  const updateCategory = DOM.bulkCategoryEnabled.checked;
  const updateOpenState = DOM.bulkOpenState.value !== "";
  if (!selected.length) return showToast("请先选择要批量修改的站点", "warning");
  if (!updateCategory && !updateOpenState) return showToast("请选择要批量修改的内容", "warning");
  selected.forEach(site => {
    if (updateCategory) site.category = DOM.bulkCategoryInput.value.trim();
    if (updateOpenState) site.open = DOM.bulkOpenState.value === "open";
  });
  selectedSiteIds.clear();
  DOM.selectAllSites.checked = false;
  autoSaveTemp();
  renderAdminDomainList();
  showToast(`已批量更新 ${selected.length} 个站点`, "success");
});
DOM.bulkImportSitesBtn.addEventListener("click", () => {
  const lines = DOM.bulkSiteInput.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return showToast("请先输入要添加的站点", "warning");
  const knownUrls = new Set(tempConfig.domainConfig.map(site => site.url));
  const accepted = [];
  const errors = [];
  lines.forEach((line, index) => {
    const [rawName = "", rawUrl = "", rawCategory = "", rawDescription = ""] = line.split("|").map(value => value.trim());
    if (!rawName || !validHttpUrl(rawUrl)) {
      errors.push(`第 ${index + 1} 行名称或 URL 无效`);
      return;
    }
    if (knownUrls.has(rawUrl)) {
      errors.push(`第 ${index + 1} 行 URL 重复`);
      return;
    }
    knownUrls.add(rawUrl);
    accepted.push({
      id: genUniqueId("site"),
      name: rawName,
      url: rawUrl,
      icon: getFaviconUrl(rawUrl),
      category: rawCategory,
      description: rawDescription,
      weight: tempConfig.domainConfig.length + accepted.length + 1,
      open: false
    });
  });
  if (!accepted.length) {
    return showToast(`没有可添加的站点。${errors.slice(0, 3).join("；")}`, "error", 6000);
  }
  tempConfig.domainConfig.push(...accepted);
  DOM.bulkSiteInput.value = "";
  autoSaveTemp();
  renderAdminDomainList();
  const errorSummary = errors.length ? `；跳过 ${errors.length} 行：${errors.slice(0, 2).join("；")}` : "";
  showToast(`已添加 ${accepted.length} 个站点${errorSummary}`, errors.length ? "warning" : "success", 6000);
});

// ==================== 仓库管理 ====================
function addRepoItem() {
  const name = DOM.embNameInput.value.trim();
  const url = DOM.embUrlInput.value.trim();
  if (!name || !url) return showToast("请填写仓库名称和地址", "warning");
  if (!validHttpUrl(url)) return showToast("仓库地址必须是http/https链接", "error");
  tempConfig.embeddedPages.push({
    id: genUniqueId("repo"),
    name,
    url
  });
  DOM.embNameInput.value = "";
  DOM.embUrlInput.value = "";
  renderEmbList();
  autoSaveTemp();
  updateJsonPreview(); // 新增：添加仓库后立刻刷新JSON预览
  showToast("仓库已添加", "success");
}
DOM.addEmbBtn.addEventListener("click", addRepoItem);

async function deleteRepoItem(id) {
  const target = tempConfig.embeddedPages.find(r => r.id === id);
  if (!target) return;
  const ok = await showConfirm("删除仓库", `确定删除仓库「${target.name}」？`);
  if (!ok) return;
  tempConfig.embeddedPages = tempConfig.embeddedPages.filter(r => r.id !== id);
  renderEmbList();
  autoSaveTemp();
  showToast("仓库已删除", "success");
}

// ==================== 自动跳转站点逻辑 ====================
function selectTargetSite(id) {
  const site = onlineConfig.domainConfig.find(s => s.id === id);
  if (!site) return;
  currentSite = site;
  onlineConfig.lastSelectSiteId = id;
  tempConfig.lastSelectSiteId = id;
  saveLocalConfig();
  renderHomeDomainList();
}
function syncCurrentSite() {
  if (!currentSite) return null;
  currentSite = onlineConfig.domainConfig.find(site => site.id === currentSite.id) || null;
  return currentSite;
}
function jumpToSite() {
  const site = syncCurrentSite();
  if (!site || !site.open || !validHttpUrl(site.url)) {
    return showToast(site?.open ? "当前站点链接格式无效" : "当前站点未开放", "error");
  }
  recordVisit(site);
  const targetUrl = new URL(site.url);
  new URLSearchParams(urlParams).forEach((value, key) => targetUrl.searchParams.append(key, value));
  if (onlineConfig.openNewTab) {
    window.open(targetUrl.href, "_blank", "noopener,noreferrer");
  } else {
    location.href = targetUrl.href;
  }
}

function recordVisit(site) {
  const visits = getVisits();
  const entry = visits[site.id] || { count: 0, lastVisited: 0 };
  entry.count += 1;
  entry.lastVisited = Date.now();
  visits[site.id] = entry;
  writeLocalJson(VISITS_KEY, visits);
  renderVisitStats();
  renderHomeDomainList();
}
function toggleFavorite(siteId) {
  const favorites = getFavorites();
  const updated = favorites.includes(siteId)
    ? favorites.filter(id => id !== siteId)
    : [...favorites, siteId];
  writeLocalJson(FAVORITES_KEY, updated);
  renderHomeDomainList();
}
function updateCategoryFilter() {
  const selected = DOM.siteCategoryFilter.value;
  const categories = [...new Set(onlineConfig.domainConfig.map(site => site.category?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  DOM.siteCategoryFilter.replaceChildren(new Option("全部分类", ""));
  categories.forEach(category => DOM.siteCategoryFilter.add(new Option(category, category)));
  if (categories.includes(selected)) DOM.siteCategoryFilter.value = selected;
}
function renderVisitStats() {
  if (!DOM.visitStats) return;
  const visits = getVisits();
  const rows = onlineConfig.domainConfig
    .map(site => ({ site, ...(visits[site.id] || { count: 0, lastVisited: 0 }) }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count || b.lastVisited - a.lastVisited)
    .slice(0, 10);
  DOM.visitStats.replaceChildren();
  if (!rows.length) {
    DOM.visitStats.innerHTML = '<div class="domain-empty">暂无访问记录（仅统计此浏览器发起的跳转）</div>';
    return;
  }
  rows.forEach(({ site, count, lastVisited }) => {
    const row = document.createElement("div");
    row.className = "stats-row";
    row.innerHTML = `<span>${escapeHtml(site.icon || "🌐")} ${escapeHtml(site.name)}</span><span>${count} 次 · ${lastVisited ? escapeHtml(new Date(lastVisited).toLocaleString()) : "—"}</span>`;
    DOM.visitStats.appendChild(row);
  });
}
const siteStatusChecksInProgress = new Set();
async function checkSiteStatus(site, { silent = false } = {}) {
  if (siteStatusChecksInProgress.has(site.id)) return;
  siteStatusChecksInProgress.add(site.id);
  try {
    const checkedAt = Date.now();
    let result;
    if (!validHttpUrl(site.url)) {
      result = { state: "invalid", url: site.url, checkedAt };
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(site.url, { method: "HEAD", mode: "cors", signal: controller.signal });
        result = {
          state: response.ok ? "reachable" :
            response.status === 405 || response.status === 501 ? "method-unsupported" : "http-error",
          url: site.url,
          statusCode: response.status,
          checkedAt
        };
      } catch (err) {
        result = {
          state: err.name === "AbortError" ? "timeout" : "unknown",
          url: site.url,
          checkedAt
        };
      } finally {
        clearTimeout(timeout);
      }
    }
    const statuses = getLinkStatuses();
    statuses[site.id] = result;
    writeLocalJson(LINK_STATUS_KEY, statuses);
    if (silent) {
      updateSiteStatusViews(site);
    } else {
      renderAdminDomainList();
    }
  } finally {
    siteStatusChecksInProgress.delete(site.id);
  }
}
function updateSiteStatusViews(site) {
  const statusText = linkStatusText(site.id, site.url);
  const availability = siteAvailability(site.id, site.url);
  for (const item of DOM.adminDomainWrap.querySelectorAll(".site-item[data-site-id]")) {
    if (item.dataset.siteId !== site.id) continue;
    const status = item.querySelector(".site-status");
    if (status) {
      status.textContent = statusText;
      status.classList.toggle("status-ok", availability.className === "reachable");
      status.classList.toggle("status-uncertain", availability.className === "uncertain");
    }
  }
}
let automaticStatusRefreshRunning = false;
async function refreshSiteStatusesSilently() {
  if (automaticStatusRefreshRunning || document.visibilityState !== "visible" || currentTab !== "jump") return;
  automaticStatusRefreshRunning = true;
  try {
    await Promise.all(onlineConfig.domainConfig.map(site => checkSiteStatus(site, { silent: true })));
  } finally {
    automaticStatusRefreshRunning = false;
  }
}
function linkStatusText(siteId, siteUrl) {
  const result = getLinkStatuses()[siteId];
  if (!result || result.url !== siteUrl) return "未检测";
  const checkedAt = new Date(result.checkedAt).toLocaleString();
  const stateText = {
    reachable: `HTTP ${result.statusCode}（HEAD 探测成功）`,
    "http-error": `HTTP ${result.statusCode}（HEAD 请求返回错误）`,
    "method-unsupported": `服务器不支持 HEAD（HTTP ${result.statusCode}），状态不确定`,
    invalid: "网址无效",
    timeout: "探测超时，状态不确定",
    unknown: "浏览器无法确认（跨域或网络限制）"
  }[result.state] || "未知";
  return `${stateText} · ${checkedAt}`;
}
function siteAvailability(siteId, siteUrl) {
  const result = getLinkStatuses()[siteId];
  if (!result || result.url !== siteUrl) return { label: "网站状态未检测", className: "unknown" };
  const states = {
    reachable: { label: "收到 HTTP 成功响应", className: "reachable" },
    "http-error": { label: "HTTP 请求返回错误", className: "unavailable" },
    "method-unsupported": { label: "不支持 HEAD 检测，状态不确定", className: "uncertain" },
    invalid: { label: "网址无效", className: "unavailable" },
    timeout: { label: "探测超时，状态不确定", className: "uncertain" },
    unknown: { label: "浏览器无法确认（跨域或网络限制）", className: "uncertain" }
  };
  return states[result.state] || { label: "网站状态未知", className: "unknown" };
}
async function checkAllSiteStatuses() {
  const sites = [...tempConfig.domainConfig];
  if (!sites.length) return showToast("目前没有可以检测的站点", "info");
  DOM.checkAllSitesBtn.disabled = true;
  try {
    for (const site of sites) {
      await checkSiteStatus(site, { silent: true });
    }
    const notifications = sites.map(site => {
      const status = getLinkStatuses()[site.id];
      const availability = siteAvailability(site.id, site.url);
      const detail = status?.statusCode ? `（HTTP ${status.statusCode}）` : "";
      const type = availability.className === "reachable"
        ? "success"
        : availability.className === "unavailable"
          ? "error"
          : "warning";
      return { message: `${site.name}：${availability.label}${detail}`, type };
    });
    if (statusNotificationMode === "summary") {
      const reachable = notifications.filter(item => item.type === "success").length;
      const unavailable = notifications.filter(item => item.type === "error").length;
      const uncertain = notifications.filter(item => item.type === "warning").length;
      showToast(
        `检测完成：成功响应 ${reachable} 个，HTTP 错误 ${unavailable} 个，状态不确定 ${uncertain} 个`,
        uncertain ? "warning" : unavailable ? "error" : "success",
        10_000
      );
    } else {
      showToastSequence(notifications);
    }
  } finally {
    DOM.checkAllSitesBtn.disabled = false;
  }
}
DOM.checkAllSitesBtn.addEventListener("click", checkAllSiteStatuses);
DOM.siteSearchInput.addEventListener("input", renderHomeDomainList);
DOM.siteCategoryFilter.addEventListener("change", renderHomeDomainList);
DOM.favoritesOnly.addEventListener("change", renderHomeDomainList);
DOM.recentOnlyBtn.addEventListener("click", () => {
  showRecentOnly = !showRecentOnly;
  DOM.recentOnlyBtn.setAttribute("aria-pressed", String(showRecentOnly));
  DOM.recentOnlyBtn.classList.toggle("active-filter", showRecentOnly);
  renderHomeDomainList();
});
// ==================== 一键保存复制JSON ====================
async function addSaveAndExport() {
  if (DOM.newPwdInput.value.trim() && !(await changeAdminPwd())) return;
  tempConfig.openNewTab = DOM.globalNewTabSwitch.checked;
  if (onlineConfig.adminPwd && !onlineConfig.adminPwdHash) {
    showToast("当前环境无法生成安全密码哈希；请使用 HTTPS 网站后再保存", "error", 5000);
    return;
  }
  recordConfigVersion(onlineConfig, "保存前自动备份");
  onlineConfig = deepClone(tempConfig);
  tempConfig = deepClone(onlineConfig);
  saveLocalConfig();
  localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
  hasLocalEdit = true;
  renderAll();
  renderAdminDomainList();
  renderEmbList();
  updateJsonPreview();

  // 复制JSON到剪贴板
  const fullJson = JSON.stringify(onlineConfig, null, 2);
  let copied = false;
  try {
    await navigator.clipboard.writeText(fullJson);
    copied = true;
  } catch (err) {
    const textarea = document.createElement("textarea");
    try {
      textarea.value = fullJson;
      textarea.style.cssText = "position:fixed;opacity:0;z-index:-9999;pointer-events:none";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
    } catch (fallbackError) {
      copied = false;
    } finally {
      textarea.remove();
    }
  }

  const publishMessage = copied
    ? "配置已保存在本机，JSON已复制；请粘贴到仓库并提交后才会发布"
    : "配置已保存在本机，但复制失败；请从JSON预览手动复制并发布";
  showToast(publishMessage, copied ? "success" : "warning", 5000);

  updateEditBadge();
}
DOM.addSaveExportBtn.addEventListener("click", addSaveAndExport);
DOM.addSaveExportBtn2.addEventListener("click", addSaveAndExport);

// ==================== 渲染函数 ====================
// 跳转台站点列表
function renderHomeDomainList() {
  const wrap = DOM.homeDomainWrap;
  wrap.replaceChildren();
  updateCategoryFilter();
  const favorites = getFavorites();
  const visits = getVisits();
  const searchTerm = DOM.siteSearchInput.value.trim().toLocaleLowerCase();
  const selectedCategory = DOM.siteCategoryFilter.value;
  const sortedList = sortedSites(onlineConfig.domainConfig).filter(item => {
    const matchesSearch = !searchTerm ||
      `${item.name} ${item.url} ${item.description || ""} ${item.category || ""}`.toLocaleLowerCase().includes(searchTerm);
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesFavorite = !DOM.favoritesOnly.checked || favorites.includes(item.id);
    const matchesRecent = !showRecentOnly || Boolean(visits[item.id]?.lastVisited);
    return matchesSearch && matchesCategory && matchesFavorite && matchesRecent;
  }).sort((a, b) => showRecentOnly
    ? (visits[b.id]?.lastVisited || 0) - (visits[a.id]?.lastVisited || 0)
    : (favorites.includes(b.id) ? 1 : 0) - (favorites.includes(a.id) ? 1 : 0) ||
      (Number(a.weight) || 0) - (Number(b.weight) || 0));
  const jumpHero = document.querySelector(".jump-hero");
  DOM.siteSummary.textContent = `${sortedList.length} / ${onlineConfig.domainConfig.length} 个站点`;
  if (onlineConfig.domainConfig.length === 0) {
    wrap.innerHTML = '<div class="domain-empty">暂无站点，请登录管理员添加</div>';
    currentSite = null;
    if (jumpHero) jumpHero.style.display = "none";
    return;
  }
  if (jumpHero) jumpHero.style.display = "block";
  if (sortedList.length === 0) {
    wrap.innerHTML = '<div class="domain-empty">没有符合筛选条件的站点</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  sortedList.forEach((item, idx) => {
    const div = document.createElement("div");
    const isFavorite = favorites.includes(item.id);
    div.className = `site-item ${item.open ? "" : "close-state"}`;
    div.dataset.siteId = item.id;
    if (currentSite?.id === item.id) div.classList.add("selected");
    div.style.animationDelay = `${idx * 0.04}s`;
    div.innerHTML = `
          <div class="site-card-main">
            <div class="site-row">
                <span class="site-name"><span class="site-icon">${siteIconMarkup(item.icon)}</span> ${escapeHtml(item.name)}</span>
            </div>
            ${(item.description || item.category) ? `<div class="site-description-row">
              ${item.description ? `<div class="site-description">${escapeHtml(item.description)}</div>` : ""}
              ${item.category ? `<span class="category-tag">${escapeHtml(item.category)}</span>` : ""}
            </div>` : ""}
            <div class="site-url">${escapeHtml(item.url)}</div>
            <div class="site-card-actions">
              <button class="btn btn-primary btn-sm site-visit-btn" type="button" ${item.open ? "" : "disabled"}>访问</button>
              <button class="btn btn-secondary btn-sm site-copy-btn" type="button">复制链接</button>
              <button class="favorite-btn ${isFavorite ? "is-favorite" : ""}" type="button" aria-label="${isFavorite ? "取消收藏" : "添加收藏"}" aria-pressed="${isFavorite}">${isFavorite ? "★" : "☆"}</button>
            </div>
          </div>
        `;
    attachSiteIconFallbacks(div, item.url);
    div.querySelector(".favorite-btn").addEventListener("click", event => {
      event.stopPropagation();
      toggleFavorite(item.id);
    });
    div.querySelector(".site-visit-btn").addEventListener("click", event => {
      event.stopPropagation();
      selectTargetSite(item.id);
      jumpToSite();
    });
    div.querySelector(".site-copy-btn").addEventListener("click", async event => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(item.url);
        showToast(`已复制「${item.name}」的网址`, "success");
      } catch (err) {
        showToast("复制失败，请手动复制站点网址", "error");
      }
    });
    div.addEventListener("click", () => selectTargetSite(item.id));
    frag.appendChild(div);
  });
  wrap.appendChild(frag);
}

// 管理员站点列表
function renderAdminDomainList() {
  const wrap = DOM.adminDomainWrap;
  wrap.innerHTML = "";
  if (!isAdminLogin) return;
  const sortedList = sortedSites(tempConfig.domainConfig);
  if (sortedList.length === 0) {
    wrap.innerHTML = '<div class="domain-empty">暂无站点</div>';
    DOM.selectAllSites.checked = false;
    updateBulkSelectionCount();
    return;
  }
  DOM.selectAllSites.checked = sortedList.every(item => selectedSiteIds.has(item.id));
  updateBulkSelectionCount();
  const frag = document.createDocumentFragment();
  sortedList.forEach(item => {
    const div = document.createElement("div");
    div.className = "site-item admin-item";
    div.dataset.siteId = item.id;
    div.style.cursor = "default";
    div.innerHTML = `
            <div class="admin-item-info">
                <div class="admin-item-heading">
                    <div class="site-name"><span class="site-icon">${siteIconMarkup(item.icon)}</span> ${escapeHtml(item.name)} | 分类:${escapeHtml(item.category || "未分类")} | 排序:${Number(item.weight) || 0}</div>
                    <label class="filter-check admin-item-select"><input type="checkbox" data-bulk-select="${escapeHtml(item.id)}" ${selectedSiteIds.has(item.id) ? "checked" : ""}> 选择</label>
                </div>
                ${item.description ? `<div class="site-description">${escapeHtml(item.description)}</div>` : ""}
                <div class="site-url">${escapeHtml(item.url)}</div>
                <div class="admin-item-footer">
                    <div class="site-status">${escapeHtml(linkStatusText(item.id, item.url))}</div>
                    <div class="admin-item-actions">
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="stat_${item.id}" value="1" ${item.open ? "checked" : ""}>
                                <span>开放</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="stat_${item.id}" value="0" ${!item.open ? "checked" : ""}>
                                <span>关闭</span>
                            </label>
                        </div>
                        <div class="admin-item-buttons">
                            <button class="btn btn-secondary btn-sm edit-btn">编辑</button>
                            <button class="btn btn-secondary btn-sm check-btn">检测</button>
                            <button class="btn btn-danger btn-sm del-btn">删除</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    attachSiteIconFallbacks(div, item.url);
    div.querySelector(".edit-btn").addEventListener("click", () => openSiteEdit(item));
    div.querySelector(".check-btn").addEventListener("click", () => checkSiteStatus(item));
    div.querySelector(".del-btn").addEventListener("click", () => deleteSiteItem(item.id));
    frag.appendChild(div);
  });
  wrap.appendChild(frag);
  wrap.querySelectorAll("[data-bulk-select]").forEach(input => {
    input.addEventListener("change", () => {
      if (input.checked) selectedSiteIds.add(input.dataset.bulkSelect);
      else selectedSiteIds.delete(input.dataset.bulkSelect);
      DOM.selectAllSites.checked = sortedList.every(item => selectedSiteIds.has(item.id));
      updateBulkSelectionCount();
    });
  });
}

// 仓库列表【修复DOM结构，适配CSS单行截断，解决名称竖排、卡片过高】
function renderEmbList() {
  const wrap = DOM.embWrap;
  wrap.innerHTML = "";
  const quickRepo = tempConfig.embeddedPages?.find(item => validHttpUrl(item.url));
  DOM.repoQuickLink.hidden = !isAdminLogin || !quickRepo;
  if (quickRepo) DOM.repoQuickLink.href = quickRepo.url;
  if (!tempConfig.embeddedPages?.length) return;
  const frag = document.createDocumentFragment();
  tempConfig.embeddedPages.forEach(item => {
    const div = document.createElement("div");
    div.className = "emb-item";
    // 新增emb-url-wrap容器包裹地址，用于弹性压缩
    div.innerHTML = `
            <span class="emb-name">${escapeHtml(item.name)}</span>
            <div class="emb-url-wrap">
                <span class="emb-url">${escapeHtml(item.url)}</span>
            </div>
            ${validHttpUrl(item.url)
        ? `<a class="btn btn-primary btn-sm emb-go-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">前往</a>`
        : '<button class="btn btn-primary btn-sm emb-go-btn" type="button" disabled>前往</button>'}
            <button class="btn btn-danger btn-sm del-btn">删除</button>
        `;
    div.querySelector(".del-btn").addEventListener("click", () => deleteRepoItem(item.id));
    frag.appendChild(div);
  });
  wrap.appendChild(frag);
}

// 全局统一渲染入口
function renderAll() {
  DOM.globalNewTabSwitch.checked = tempConfig.openNewTab;
  renderHomeDomainList();
}

// 页面加载自动选中第一个开放站点
function autoSelectDefaultSite() {
  const firstOpen = getFirstOpenSite();
  if (!firstOpen) return;
  selectTargetSite(firstOpen.id);
}

// ==================== 页面加载监听 ====================
window.addEventListener("load", loadAllConfig);
window.addEventListener("offline", () => showToast("网络已断开", "warning"));
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && DOM.editSection.style.display !== "none") {
    DOM.editSection.style.display = "none";
  }
});