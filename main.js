/* ================================================================
   网站中转站 - Tab 选项卡版
   修复点：
   1. 仅跳转台页面倒计时运行，其余页面切换立刻暂停，保存不启动倒计时
   2. 一键保存复制JSON，自动读取仓库列表第一条地址新开标签打开（不再读取输入框）
   3. 彻底移除iframe仓库预览，只保留仓库增删列表
   4. 无JSON文件下载，仅复制剪贴板
   5. 仓库列表DOM结构重构，适配CSS单行截断，名称不会竖排、卡片不会异常增高
   6. 修复切换站点管理Tab/登录后仓库不渲染问题
   7. 修复旧配置缺失embeddedPages字段导致仓库无法保存加载
================================================================ */
const STORAGE_KEY = "jump_config";
const LOGIN_STORAGE_KEY = "admin_is_login";
const HAS_EDIT_STORAGE_KEY = "jump_has_edit";
const THEME_LIST = ["", "purple", "mint", "coral", "deepblue", "pink"];
const CONFIG_KEYS = ["waitSecond", "openNewTab", "theme", "lastSelectSiteId", "repoUrl", "adminPwd", "domainConfig", "embeddedPages"];
const DEFAULT_CONFIG = {
    waitSecond: 10,
    openNewTab: true,
    theme: "",
    lastSelectSiteId: "",
    repoUrl: "",
    adminPwd: "admin123",
    domainConfig: [],
    embeddedPages: []
};

let onlineConfig = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
let tempConfig = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
let onlineConfigLoaded = false;
let timer = null, count = 0, isPause = false, currentSite = null;
let isAdminLogin = localStorage.getItem(LOGIN_STORAGE_KEY) === "1";
let adminPassword = DEFAULT_CONFIG.adminPwd;
let hasLocalEdit = localStorage.getItem(HAS_EDIT_STORAGE_KEY) === "1";
const urlParams = window.location.search;

const $ = id => document.getElementById(id);
const DOM = {
    toastContainer: $("toastContainer"),
    themeSwitchBtn: $("themeSwitchBtn"),
    sourceTip: $("sourceTip"),
    circleLoader: $("circleLoader"),
    countDom: $("count-num"),
    progressBar: $("progress-bar"),
    homeDomainWrap: $("homeDomainWrap"),
    pauseBtn: $("pauseBtn"),
    jumpBtn: $("jumpBtn"),
    loginSection: $("loginSection"),
    adminPwdInput: $("adminPwdInput"),
    loginBtn: $("loginBtn"),
    sitesContent: $("sitesContent"),
    configContent: $("configContent"),
    configLoginHint: $("configLoginHint"),
    newPwdInput: $("newPwdInput"),
    waitSecondInput: $("waitSecondInput"),
    globalNewTabSwitch: $("globalNewTabSwitch"),
    siteNameInput: $("siteNameInput"),
    siteUrlInput: $("siteUrlInput"),
    siteWeightInput: $("siteWeightInput"),
    addSiteBtn: $("addSiteBtn"),
    adminDomainWrap: $("adminDomainWrap"),
    editSection: $("editSection"),
    editCloseBtn: $("editCloseBtn"),
    editSiteId: $("editSiteId"),
    editNameInput: $("editNameInput"),
    editUrlInput: $("editUrlInput"),
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
    logoutBtn: $("logoutBtn"),
    embeddedSection: $("embeddedSection"),
    embTabs: $("embTabs"),
    embFrameWrap: $("embFrameWrap")
};

// ==================== Tab切换倒计时控制 ====================
let currentTab = localStorage.getItem("lastTab") || "jump";
function switchTab(tabName) {
    currentTab = tabName;
    localStorage.setItem("lastTab", tabName);
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `panel-${tabName}`);
    });
    if (tabName === "jump") {
        resetCountdown();
    } else {
        clearInterval(timer);
    }
    // 新增：切换站点管理页自动渲染仓库
    if(tabName === "sites" && isAdminLogin){
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
function validHttpUrl(url) {
    return /^https?:\/\/.+/.test(url.trim());
}
function urlExistInList(url, excludeId = "") {
    return tempConfig.domainConfig.some(item => item.url === url && item.id !== excludeId);
}
function genUniqueId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function getFirstOpenSite() {
    const openList = onlineConfig.domainConfig.filter(item => item.open);
    if (openList.length === 0) return null;
    openList.sort((a, b) => (Number(a.weight) || 1) - (Number(b.weight) || 1));
    return openList[0];
}

// ==================== Toast弹窗 ====================
function showToast(message, type = "info", duration = 3000) {
    if (!DOM.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    toast.textContent = message;
    toast.addEventListener("click", () => removeToast(toast));
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => removeToast(toast), duration);
}
function removeToast(el) {
    if (!el.parentNode) return;
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

// ==================== 主题切换 ====================
function toggleTheme() {
    const idx = (THEME_LIST.indexOf(onlineConfig.theme) + 1) % THEME_LIST.length;
    onlineConfig.theme = THEME_LIST[idx];
    tempConfig.theme = onlineConfig.theme;
    saveLocalConfig();
    document.documentElement.setAttribute("data-theme", onlineConfig.theme);
    showToast("主题已切换", "success", 1500);
    updateJsonPreview();
}
DOM.themeSwitchBtn.addEventListener("click", toggleTheme);
function applySavedTheme() {
    document.documentElement.setAttribute("data-theme", onlineConfig.theme || "");
}

// ==================== 本地存储读写 ====================
function saveLocalConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(onlineConfig));
    } catch (err) {}
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
        if(!onlineConfig.embeddedPages) onlineConfig.embeddedPages = [];
        adminPassword = onlineConfig.adminPwd;
    } catch (err) {}
}

// ==================== 临时配置自动保存 ====================
function autoSaveTemp() {
    onlineConfig = deepClone(tempConfig);
    saveLocalConfig();
    localStorage.setItem(HAS_EDIT_STORAGE_KEY, "1");
    hasLocalEdit = true;
    renderHomeDomainList();
    updateJumpBtnStatus();
    updateJsonPreview();
    updateEditBadge();
}
function updateEditBadge() {
    if (!DOM.editsBadge) return;
    DOM.editsBadge.style.display = (hasLocalEdit && isAdminLogin) ? "inline-block" : "none";
}

// ==================== 页面初始化加载 ====================
async function loadAllConfig() {
    loadLocalConfig();
    hasLocalEdit = localStorage.getItem(HAS_EDIT_STORAGE_KEY) === "1";
    if (!hasLocalEdit) {
        try {
            const res = await fetch(`config.json?t=${Date.now()}`);
            if (!res.ok) throw new Error("no config");
            const remoteCfg = await res.json();
            const fullCfg = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
            CONFIG_KEYS.forEach(k => {
                if (remoteCfg[k] !== undefined) fullCfg[k] = remoteCfg[k];
            });
            onlineConfig = fullCfg;
            adminPassword = onlineConfig.adminPwd;
            saveLocalConfig();
        } catch (err) {
            showToast("加载线上配置失败，使用本地缓存", "warning", 4000);
        }
    } else {
        showToast("已恢复上次编辑状态", "info", 2000);
    }
    onlineConfigLoaded = true;
    tempConfig = deepClone(onlineConfig);
    applySavedTheme();
    renderAll();
    autoSelectDefaultSite();
    resetCountdown();
    if (isAdminLogin) renderAdminPanel();
    updateJsonPreview();
    updateEditBadge();
    switchTab(currentTab);
    const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
    if (jsonTabBtn) jsonTabBtn.style.display = isAdminLogin ? "flex" : "none";
    renderEmbList();
}

// ==================== JSON预览刷新 ====================
function updateJsonPreview() {
    if (!DOM.jsonPreview) return;
    DOM.jsonPreview.textContent = JSON.stringify({
        waitSecond: tempConfig.waitSecond,
        openNewTab: tempConfig.openNewTab,
        theme: tempConfig.theme,
        lastSelectSiteId: tempConfig.lastSelectSiteId,
        repoUrl: tempConfig.repoUrl,
        adminPwd: tempConfig.adminPwd,
        domainConfig: tempConfig.domainConfig,
        embeddedPages: tempConfig.embeddedPages
    }, null, 2);
}

// ==================== 管理员登录登出 ====================
async function adminLogin() {
    const pwd = DOM.adminPwdInput.value.trim();
    if (!pwd) return showToast("请输入管理员密码", "warning");
    let match = pwd === adminPassword;
    if (!match && window.crypto?.subtle) {
        try {
            const encoder = new TextEncoder();
            const hash1 = await crypto.subtle.digest("SHA-256", encoder.encode(pwd));
            const hash2 = await crypto.subtle.digest("SHA-256", encoder.encode(adminPassword));
            const arr1 = new Uint8Array(hash1);
            const arr2 = new Uint8Array(hash2);
            match = arr1.every((v, i) => v === arr2[i]);
        } catch (err) {}
    }
    if (match) {
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
    DOM.embeddedSection.style.display = "none";
    DOM.adminPwdInput.value = "";
    showToast("已登出管理员", "info");
    updateEditBadge();
    const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
    if (jsonTabBtn) jsonTabBtn.style.display = "none";
    switchTab("jump");
}
DOM.logoutBtn.addEventListener("click", adminLogout);

// 修改管理员密码
function changeAdminPwd() {
    const newPwd = DOM.newPwdInput.value.trim();
    if (!newPwd) return showToast("密码不能为空", "warning");
    tempConfig.adminPwd = newPwd;
    adminPassword = newPwd;
    DOM.newPwdInput.value = "";
    autoSaveTemp();
    showToast("管理员密码已保存", "success");
}
DOM.newPwdInput.addEventListener("keydown", e => {
    if (e.key === "Enter") changeAdminPwd();
});
function syncConfigToForm() {
    DOM.waitSecondInput.value = tempConfig.waitSecond;
    DOM.globalNewTabSwitch.checked = tempConfig.openNewTab;
}

// ==================== 站点管理 ====================
function addNewSite() {
    const name = DOM.siteNameInput.value.trim();
    const url = DOM.siteUrlInput.value.trim();
    const weight = Number(DOM.siteWeightInput.value) || 1;
    if (!name || !url) return showToast("请填写站点名称和链接", "warning");
    if (!validHttpUrl(url)) return showToast("链接必须以http/https开头", "error");
    if (urlExistInList(url)) return showToast("该站点已存在", "warning");
    const newItem = {
        id: genUniqueId("site"),
        name,
        url,
        weight,
        open: false
    };
    tempConfig.domainConfig.push(newItem);
    DOM.siteNameInput.value = "";
    DOM.siteUrlInput.value = "";
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
    renderAdminDomainList();
    autoSaveTemp();
    showToast("站点已删除", "success");
}

function openSiteEdit(item) {
    DOM.editSiteId.value = item.id;
    DOM.editNameInput.value = item.name;
    DOM.editUrlInput.value = item.url;
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
    const weight = Number(DOM.editWeightInput.value) || 1;
    const open = DOM.editOpenCheck.checked;
    if (!name || !url) return showToast("名称和链接不能为空", "warning");
    if (!validHttpUrl(url)) return showToast("链接格式错误", "error");
    if (urlExistInList(url, editId)) return showToast("该链接已被其他站点占用", "warning");
    const target = tempConfig.domainConfig.find(s => s.id === editId);
    if (!target) return;
    target.name = name;
    target.url = url;
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
    updateJumpBtnStatus();
    resetCountdown();
    renderHomeDomainList();
}
function updateJumpBtnStatus() {
    DOM.jumpBtn.disabled = !(currentSite && currentSite.open);
}
function jumpToSite() {
    if (!currentSite || !currentSite.open) return showToast("当前站点未开放", "error");
    clearInterval(timer);
    const jumpUrl = currentSite.url + urlParams;
    if (onlineConfig.openNewTab) {
        window.open(jumpUrl, "_blank");
    } else {
        location.href = jumpUrl;
    }
}
DOM.jumpBtn.addEventListener("click", jumpToSite);

// ==================== 倒计时逻辑 ====================
function resetCountdown() {
    clearInterval(timer);
    isPause = false;
    DOM.pauseBtn.textContent = "暂停倒计时";
    count = Number(onlineConfig.waitSecond) || 10;
    DOM.countDom.textContent = count;
    DOM.progressBar.style.width = "0%";
    DOM.circleLoader.classList.remove("paused");
    startCountTimer();
}
function startCountTimer() {
    const totalSec = onlineConfig.waitSecond || 10;
    timer = setInterval(() => {
        if (!currentSite || !currentSite.open || isPause) return;
        count -= 1;
        DOM.countDom.textContent = count;
        const percent = ((totalSec - count) / totalSec) * 100;
        DOM.progressBar.style.width = `${percent}%`;
        if (count <= 3 && count > 0) {
            DOM.countDom.style.transform = "scale(1.12)";
            setTimeout(() => DOM.countDom.style.transform = "scale(1)", 180);
        }
        if (count <= 0) {
            clearInterval(timer);
            jumpToSite();
        }
    }, 1000);
}
DOM.pauseBtn.addEventListener("click", () => {
    isPause = !isPause;
    DOM.pauseBtn.textContent = isPause ? "恢复倒计时" : "暂停倒计时";
    DOM.circleLoader.classList.toggle("paused", isPause);
});

// ==================== 一键保存复制JSON（方案A：读取仓库列表第一条地址自动打开） ====================
async function addSaveAndExport() {
    if (DOM.newPwdInput.value.trim()) changeAdminPwd();
    tempConfig.waitSecond = Number(DOM.waitSecondInput.value) || 10;
    tempConfig.openNewTab = DOM.globalNewTabSwitch.checked;
    tempConfig.adminPwd = adminPassword;
    onlineConfig = deepClone(tempConfig);
    tempConfig = deepClone(onlineConfig);
    saveLocalConfig();
    renderAll();
    renderAdminDomainList();
    renderEmbList();
    // 仅跳转台页面重置倒计时，其他页面不启动
    if (currentTab === "jump") {
        resetCountdown();
    }
    updateJsonPreview();

    // 复制JSON到剪贴板
    const fullJson = JSON.stringify(onlineConfig, null, 2);
    try {
        await navigator.clipboard.writeText(fullJson);
    } catch (err) {
        const textarea = document.createElement("textarea");
        textarea.value = fullJson;
        textarea.style.cssText = "position:fixed;opacity:0;z-index:-9999;pointer-events:none";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
    }

    // 方案A：读取仓库列表第一条地址，不再读取输入框
    let openRepoUrl = "";
    if (tempConfig.embeddedPages.length > 0) {
        openRepoUrl = tempConfig.embeddedPages[0].url;
    }

    if (openRepoUrl) {
        if (validHttpUrl(openRepoUrl)) {
            window.open(openRepoUrl, "_blank");
            showToast("配置已保存，JSON已复制剪贴板，仓库地址已新标签打开", "success", 4000);
        } else {
            showToast("配置已保存，JSON已复制剪贴板，仓库地址格式无效无法打开", "warning", 4000);
        }
    } else {
        showToast("配置已保存，JSON已复制剪贴板（暂无仓库）", "success", 4000);
    }

    localStorage.removeItem(HAS_EDIT_STORAGE_KEY);
    hasLocalEdit = false;
    updateEditBadge();
}
DOM.addSaveExportBtn.addEventListener("click", addSaveAndExport);
DOM.addSaveExportBtn2.addEventListener("click", addSaveAndExport);

// ==================== 渲染函数 ====================
// 跳转台站点列表
function renderHomeDomainList() {
    const wrap = DOM.homeDomainWrap;
    wrap.innerHTML = "";
    const sortedList = [...onlineConfig.domainConfig].sort((a, b) => (Number(a.weight) || 1) - (Number(b.weight) || 1));
    const jumpHero = document.querySelector(".jump-hero");
    if (sortedList.length === 0) {
        wrap.innerHTML = '<div class="domain-empty">暂无站点，请登录管理员添加</div>';
        currentSite = null;
        updateJumpBtnStatus();
        if (jumpHero) jumpHero.style.display = "none";
        return;
    }
    if (jumpHero) jumpHero.style.display = "block";
    const frag = document.createDocumentFragment();
    sortedList.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = `site-item ${item.open ? "" : "close-state"}`;
        if (currentSite?.id === item.id) div.classList.add("selected");
        div.style.animationDelay = `${idx * 0.04}s`;
        div.innerHTML = `
            <div class="site-row">
                <span class="site-name">${escapeHtml(item.name)}</span>
                <span class="site-tag ${item.open ? "open" : "closed"}">${item.open ? "已开放" : "未开放"}</span>
            </div>
            <div class="site-url">${escapeHtml(item.url)}</div>
        `;
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
    const sortedList = [...tempConfig.domainConfig].sort((a, b) => (Number(a.weight) || 1) - (Number(b.weight) || 1));
    if (sortedList.length === 0) {
        wrap.innerHTML = '<div class="domain-empty">暂无站点</div>';
        return;
    }
    const frag = document.createDocumentFragment();
    sortedList.forEach(item => {
        const div = document.createElement("div");
        div.className = "site-item admin-item";
        div.style.cursor = "default";
        div.innerHTML = `
            <div class="admin-item-info">
                <div class="site-name">${escapeHtml(item.name)} | 权重:${item.weight || 1}</div>
                <div class="site-url">${escapeHtml(item.url)}</div>
            </div>
            <div class="admin-item-actions">
                <div class="radio-group" style="display:flex;gap:8px;font-size:12px;">
                    <label class="radio-label">
                        <input type="radio" name="stat_${item.id}" value="1" ${item.open ? "checked" : ""}>
                        <span>开放</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="stat_${item.id}" value="0" ${!item.open ? "checked" : ""}>
                        <span>关闭</span>
                    </label>
                </div>
                <button class="btn btn-secondary btn-sm edit-btn">编辑</button>
                <button class="btn btn-danger btn-sm del-btn">删除</button>
            </div>
        `;
        div.querySelector(".edit-btn").addEventListener("click", () => openSiteEdit(item));
        div.querySelector(".del-btn").addEventListener("click", () => deleteSiteItem(item.id));
        frag.appendChild(div);
    });
    wrap.appendChild(frag);
}

// 仓库列表【修复DOM结构，适配CSS单行截断，解决名称竖排、卡片过高】
function renderEmbList() {
    const wrap = DOM.embWrap;
    wrap.innerHTML = "";
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
            <button class="btn btn-danger btn-sm del-btn" style="padding:3px 8px;font-size:11px;">删除</button>
        `;
        div.querySelector(".del-btn").addEventListener("click", () => deleteRepoItem(item.id));
        frag.appendChild(div);
    });
    wrap.appendChild(frag);
}

// 全局统一渲染入口
function renderAll() {
    DOM.waitSecondInput.value = tempConfig.waitSecond;
    DOM.globalNewTabSwitch.checked = tempConfig.openNewTab;
    renderHomeDomainList();
    updateJumpBtnStatus();
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
