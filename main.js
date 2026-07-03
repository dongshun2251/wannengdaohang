/* ================================================================
   网站中转站 - Tab 选项卡版
   ================================================================ */

const STORAGE_KEY = "jump_config";
const LOGIN_STORAGE_KEY = "admin_is_login";
const HAS_EDITS_KEY = "jump_has_edits";
const THEME_LIST = ["", "purple", "mint", "coral", "deepblue", "pink"];
const CONFIG_KEYS = ["waitSecond", "openNewTab", "theme", "lastSelectSiteId", "repoUrl", "adminPwd", "domainConfig", "embeddedPages"];
const DEFAULT_CONFIG = { waitSecond: 10, openNewTab: true, theme: "", lastSelectSiteId: "", repoUrl: "", adminPwd: "admin123", domainConfig: [], embeddedPages: [] };

let onlineConfig = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
let tempConfig = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
let onlineConfigLoaded = false;
let timer = null, count = 0, isPause = false, currentSite = null;
let isAdminLogin = localStorage.getItem(LOGIN_STORAGE_KEY) === "1";
let adminPassword = DEFAULT_CONFIG.adminPwd;
let hasLocalEdits = localStorage.getItem(HAS_EDITS_KEY) === "1";
const params = window.location.search;

const $ = id => document.getElementById(id);
const DOM = {
    toastContainer: $("toastContainer"), themeSwitchBtn: $("themeSwitchBtn"), sourceTip: $("sourceTip"),
    circleLoader: $("circleLoader"), countDom: $("count-num"), barDom: $("progress-bar"),
    homeDomainWrap: $("homeDomainWrap"), pauseBtn: $("pauseBtn"), jumpBtn: $("jumpBtn"),
    loginSection: $("loginSection"), adminPwdInput: $("adminPwdInput"), loginBtn: $("loginBtn"),
    sitesContent: $("sitesContent"), configContent: $("configContent"), configLoginHint: $("configLoginHint"),
    newPwdInput: $("newPwdInput"), waitSecondInput: $("waitSecondInput"), globalNewTabSwitch: $("globalNewTabSwitch"),
    siteNameInput: $("siteNameInput"), siteUrlInput: $("siteUrlInput"), siteWeightInput: $("siteWeightInput"),
    addSiteBtn: $("addSiteBtn"), adminDomainWrap: $("adminDomainWrap"),
    editSection: $("editSection"), editCloseBtn: $("editCloseBtn"),
    editSiteId: $("editSiteId"), editNameInput: $("editNameInput"), editUrlInput: $("editUrlInput"),
    editWeightInput: $("editWeightInput"), editOpenCheck: $("editOpenCheck"), editSaveBtn: $("editSaveBtn"),
    embNameInput: $("embNameInput"), embUrlInput: $("embUrlInput"), addEmbBtn: $("addEmbBtn"), embWrap: $("embWrap"),
    jsonPreview: $("jsonPreview"), editsBadge: $("editsBadge"),
    addSaveExportBtn: $("addSaveExportBtn"), addSaveExportBtn2: $("addSaveExportBtn2"), logoutBtn: $("logoutBtn"),
    embeddedSection: $("embeddedSection"), embTabs: $("embTabs"), embFrameWrap: $("embFrameWrap")
};

// ==================== Tab 切换 ====================
// 优先读取上次保存的标签，无记录才默认跳转台
let currentTab = localStorage.getItem("lastTab") || "jump";


function switchTab(tabName) {
    currentTab = tabName;
    // 保存当前选中标签到本地存储
    localStorage.setItem("lastTab", tabName);
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === "panel-" + tabName);
    });
}


document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ==================== 工具 ====================
function escapeHtml(s) { const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(s).replace(/[&<>"']/g, c => m[c]); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function isValidUrl(u) { return /^https?:\/\/.+/i.test(u.trim()); }
function isUrlDuplicate(u, ex) { return tempConfig.domainConfig.some(i => i.url === u && i.id !== ex); }
function genId(p) { return p + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }
function getTopWeightOpenSite() { const l = onlineConfig.domainConfig.filter(s => s.open); if (!l.length) return null; l.sort((a, b) => (Number(a.weight) || 1) - (Number(b.weight) || 1)); return l[0]; }

// ==================== Toast ====================
function showToast(msg, type = "info", dur = 3000) {
    if (!DOM.toastContainer) return;
    const t = document.createElement("div"); t.className = "toast-item toast-" + type; t.textContent = msg;
    t.addEventListener("click", () => removeToast(t)); DOM.toastContainer.appendChild(t);
    setTimeout(() => removeToast(t), dur);
}
function removeToast(t) { if (!t.parentNode) return; t.classList.add("toast-out"); setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 250); }

// ==================== 确认弹窗 ====================
function showConfirm(title, message) {
    return new Promise(resolve => {
        const o = document.createElement("div"); o.className = "confirm-overlay";
        o.innerHTML = '<div class="confirm-box"><div class="ct">' + escapeHtml(title) + '</div><div class="cm">' + escapeHtml(message) + '</div><div class="cb"><button class="c-cancel">取消</button><button class="c-ok">确认</button></div></div>';
        document.body.appendChild(o);
        const cl = r => { o.remove(); resolve(r); };
        o.querySelector(".c-cancel").addEventListener("click", () => cl(false));
        o.querySelector(".c-ok").addEventListener("click", () => cl(true));
        o.addEventListener("click", e => { if (e.target === o) cl(false); });
        const kh = e => { if (e.key === "Escape") { cl(false); document.removeEventListener("keydown", kh); } };
        document.addEventListener("keydown", kh);
    });
}

// ==================== 主题 ====================
function switchTheme() {
    const i = (THEME_LIST.indexOf(onlineConfig.theme) + 1) % THEME_LIST.length;
    onlineConfig.theme = THEME_LIST[i]; tempConfig.theme = onlineConfig.theme;
    saveLocalConfig(); document.documentElement.setAttribute("data-theme", onlineConfig.theme);
    showToast("主题已切换", "success", 1500); updateJsonPreview();
}
DOM.themeSwitchBtn.addEventListener("click", switchTheme);
function applySavedTheme() { document.documentElement.setAttribute("data-theme", onlineConfig.theme || ""); }

// ==================== 配置存储 ====================
function saveLocalConfig() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(onlineConfig)); } catch (e) { }
}
function loadLocalConfig() {
    try {
        const r = localStorage.getItem(STORAGE_KEY); if (!r) return;
        const d = JSON.parse(r); CONFIG_KEYS.forEach(k => { if (d.hasOwnProperty(k)) onlineConfig[k] = d[k]; });
        adminPassword = onlineConfig.adminPwd;
    } catch (e) { }
}

// ==================== 自动保存 ====================
function autoSaveTempConfig() {
    onlineConfig = deepClone(tempConfig);
    saveLocalConfig(); localStorage.setItem(HAS_EDITS_KEY, "1"); hasLocalEdits = true;
    renderHomeDomainList(); updateJumpBtnStatus();
    if (isAdminLogin) renderEmbeddedFrames();
    updateJsonPreview(); updateEditsBadge();
}
function updateEditsBadge() {
    if (DOM.editsBadge) DOM.editsBadge.style.display = hasLocalEdits && isAdminLogin ? "inline-block" : "none";
}

// ==================== 加载 ====================
async function loadOnlineConfig() {
    loadLocalConfig();
    hasLocalEdits = localStorage.getItem(HAS_EDITS_KEY) === "1";
    if (!hasLocalEdits) {
        try {
            const res = await fetch("config.json?t=" + Date.now());
            if (!res.ok) throw new Error("404");
            const rawData = await res.json();
            const full = { ...DEFAULT_CONFIG, domainConfig: [], embeddedPages: [] };
            CONFIG_KEYS.forEach(k => { if (rawData.hasOwnProperty(k)) full[k] = rawData[k]; });
            onlineConfig = full; adminPassword = onlineConfig.adminPwd; saveLocalConfig();
        } catch (e) { showToast("加载线上配置失败，使用本地缓存", "warning", 4000); }
    } else { showToast("已恢复上次编辑状态", "info", 2000); }
    onlineConfigLoaded = true;
    tempConfig = deepClone(onlineConfig);
    applySavedTheme(); renderAll(); autoSelectSiteOnLoad(); resetCountdown();
    if (isAdminLogin) showAdminUI();
    updateJsonPreview(); updateEditsBadge();
    switchTab(currentTab);
    // 初始化：未登录隐藏JSON预览标签
    const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
    if(jsonTabBtn){
        jsonTabBtn.style.display = isAdminLogin ? "flex" : "none";
    }
}


// ==================== JSON 预览 ====================
function updateJsonPreview() {
    if (!DOM.jsonPreview) return;
    DOM.jsonPreview.textContent = JSON.stringify({
        waitSecond: tempConfig.waitSecond, openNewTab: tempConfig.openNewTab, theme: tempConfig.theme,
        lastSelectSiteId: tempConfig.lastSelectSiteId, repoUrl: tempConfig.repoUrl, adminPwd: tempConfig.adminPwd,
        domainConfig: tempConfig.domainConfig, embeddedPages: tempConfig.embeddedPages
    }, null, 2);
}

// ==================== 登录/登出 ====================
async function doLogin() {
    const pwd = DOM.adminPwdInput.value.trim();
    if (!pwd) return showToast("请输入密码", "warning");
    let matched = pwd === adminPassword;
    if (!matched && window.crypto && crypto.subtle) {
        try {
            const enc = new TextEncoder();
            const h1 = await crypto.subtle.digest('SHA-256', enc.encode(pwd));
            const h2 = await crypto.subtle.digest('SHA-256', enc.encode(adminPassword));
            const hx = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
            matched = hx(h1) === hx(h2);
        } catch (e) { }
    }
    if (matched) { isAdminLogin = true; localStorage.setItem(LOGIN_STORAGE_KEY, "1"); showAdminUI(); showToast("登录成功", "success"); }
    else showToast("密码错误", "error");
}
DOM.loginBtn.addEventListener("click", doLogin);
DOM.adminPwdInput.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

function showAdminUI() {
    DOM.loginSection.style.display = "none";
    DOM.sitesContent.style.display = "block";
    DOM.configContent.style.display = "block";
    DOM.configLoginHint.style.display = "none";
    tempConfig = deepClone(onlineConfig);
    syncFormFromTemp(); renderAdminDomainList(); renderEmbList(); updateJsonPreview(); updateEditsBadge();
    renderEmbeddedFrames();
    // 登录后显示JSON预览Tab按钮
    const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
    if(jsonTabBtn) jsonTabBtn.style.display = "flex";
}

function logoutAdmin() {
    isAdminLogin = false; localStorage.removeItem(LOGIN_STORAGE_KEY);
    DOM.loginSection.style.display = ""; DOM.sitesContent.style.display = "none";
    DOM.configContent.style.display = "none"; DOM.configLoginHint.style.display = "block";
    DOM.embeddedSection.style.display = "none";
    DOM.adminPwdInput.value = ""; showToast("已登出", "info"); updateEditsBadge();
    // 退出登录隐藏JSON预览，切回跳转台
    const jsonTabBtn = document.querySelector('.tab-btn[data-tab="json"]');
    if(jsonTabBtn) jsonTabBtn.style.display = "none";
    switchTab("jump");
}
DOM.logoutBtn.addEventListener("click", logoutAdmin);

function changePwd() {
    const p = DOM.newPwdInput.value.trim();
    if (!p) return showToast("密码不能为空", "warning");
    tempConfig.adminPwd = p; adminPassword = p; DOM.newPwdInput.value = "";
    autoSaveTempConfig(); showToast("密码已保存", "success");
}
DOM.newPwdInput.addEventListener("keydown", e => { if (e.key === "Enter") changePwd(); });
function syncFormFromTemp() { DOM.waitSecondInput.value = tempConfig.waitSecond; DOM.globalNewTabSwitch.checked = tempConfig.openNewTab; }

// ==================== 站点管理 ====================
function addNewSite() {
    const n = DOM.siteNameInput.value.trim(), u = DOM.siteUrlInput.value.trim(), w = Number(DOM.siteWeightInput.value) || 1;
    if (!n || !u) return showToast("请填写名称和链接", "warning");
    if (!isValidUrl(u)) return showToast("链接需 http:// 或 https://", "error");
    if (isUrlDuplicate(u)) return showToast("域名已存在", "error");
    tempConfig.domainConfig.push({ id: genId("site"), name: n, url: u, weight: w, open: false });
    DOM.siteNameInput.value = ""; DOM.siteUrlInput.value = ""; DOM.siteWeightInput.value = "1";
    renderAdminDomainList(); autoSaveTempConfig(); showToast("站点已添加", "success");
}
DOM.addSiteBtn.addEventListener("click", addNewSite);

async function deleteSite(id) {
    const t = tempConfig.domainConfig.find(s => s.id === id); if (!t) return;
    if (!(await showConfirm("删除站点", "确定删除「" + t.name + "」？"))) return;
    tempConfig.domainConfig = tempConfig.domainConfig.filter(i => i.id !== id);
    renderAdminDomainList(); autoSaveTempConfig(); showToast("已删除", "success");
}

function openEditSection(s) {
    DOM.editSiteId.value = s.id; DOM.editNameInput.value = s.name; DOM.editUrlInput.value = s.url;
    DOM.editWeightInput.value = Number(s.weight || 1); DOM.editOpenCheck.checked = s.open;
    DOM.editSection.style.display = ""; DOM.editSection.scrollIntoView({ behavior: "smooth", block: "center" });
}
DOM.editCloseBtn.addEventListener("click", () => { DOM.editSection.style.display = "none"; });

function saveEditSite() {
    const sid = DOM.editSiteId.value, n = DOM.editNameInput.value.trim(), u = DOM.editUrlInput.value.trim();
    const w = Number(DOM.editWeightInput.value) || 1, op = DOM.editOpenCheck.checked;
    if (!n || !u) return showToast("名称和链接不能为空", "warning");
    if (!isValidUrl(u)) return showToast("链接需 http:// 或 https://", "error");
    if (isUrlDuplicate(u, sid)) return showToast("域名已被占用", "error");
    const item = tempConfig.domainConfig.find(s => s.id === sid); if (!item) return;
    Object.assign(item, { name: n, url: u, weight: w, open: op });
    DOM.editSection.style.display = "none"; renderAdminDomainList(); autoSaveTempConfig(); showToast("修改已保存", "success");
}
DOM.editSaveBtn.addEventListener("click", saveEditSite);

document.addEventListener("change", e => {
    if (e.target.name && e.target.name.startsWith("stat_")) {
        const s = tempConfig.domainConfig.find(x => x.id === e.target.name.replace("stat_", ""));
        if (s) { s.open = e.target.value === "1"; autoSaveTempConfig(); }
    }
});

// ==================== 内嵌网页 ====================
function addEmbeddedPage() {
    const n = DOM.embNameInput.value.trim(), u = DOM.embUrlInput.value.trim();
    if (!n || !u) return showToast("请填写名称和链接", "warning");
    if (!isValidUrl(u)) return showToast("链接需 http:// 或 https://", "error");
    tempConfig.embeddedPages.push({ id: genId("emb"), name: n, url: u });
    DOM.embNameInput.value = ""; DOM.embUrlInput.value = "";
    renderEmbList(); autoSaveTempConfig(); showToast("内嵌网页已添加", "success");
}
DOM.addEmbBtn.addEventListener("click", addEmbeddedPage);

async function deleteEmb(id) {
    const t = tempConfig.embeddedPages.find(p => p.id === id); if (!t) return;
    if (!(await showConfirm("删除内嵌网页", "确定删除「" + t.name + "」？"))) return;
    tempConfig.embeddedPages = tempConfig.embeddedPages.filter(p => p.id !== id);
    renderEmbList(); autoSaveTempConfig(); showToast("已删除", "success");
}

// ==================== 跳转 ====================
function selectSite(id) {
    const t = onlineConfig.domainConfig.find(s => s.id === id); if (!t) return;
    currentSite = t; onlineConfig.lastSelectSiteId = id; tempConfig.lastSelectSiteId = id;
    saveLocalConfig(); updateJumpBtnStatus(); resetCountdown(); renderHomeDomainList();
}
function updateJumpBtnStatus() { DOM.jumpBtn.disabled = !(currentSite && currentSite.open); }
function goJump() {
    if (!currentSite || !currentSite.open) return showToast("站点未开放", "error");
    clearInterval(timer); const u = currentSite.url + params;
    if (onlineConfig.openNewTab) window.open(u, "_blank"); else location.href = u;
}
DOM.jumpBtn.addEventListener("click", goJump);

// ==================== 倒计时 ====================
function resetCountdown() {
    clearInterval(timer); isPause = false; DOM.pauseBtn.textContent = "暂停倒计时";
    count = Number(onlineConfig.waitSecond) || 10; DOM.countDom.textContent = count;
    DOM.barDom.style.width = "0%"; DOM.circleLoader.classList.remove("paused"); startTimer();
}
function startTimer() {
    const total = onlineConfig.waitSecond || 10;
    timer = setInterval(() => {
        if (!currentSite || !currentSite.open || isPause) return;
        count--; DOM.countDom.textContent = count; DOM.barDom.style.width = ((total - count) / total * 100) + "%";
        if (count <= 3 && count > 0) { DOM.countDom.style.transform = "scale(1.12)"; setTimeout(() => { DOM.countDom.style.transform = "scale(1)"; }, 180); }
        if (count <= 0) { clearInterval(timer); goJump(); }
    }, 1000);
}
DOM.pauseBtn.addEventListener("click", () => {
    isPause = !isPause; DOM.pauseBtn.textContent = isPause ? "恢复倒计时" : "暂停倒计时";
    DOM.circleLoader.classList.toggle("paused", isPause);
});

// ==================== 一键保存并导出 ====================
async function addSaveAndExport() {
    if (DOM.newPwdInput.value.trim()) changePwd();
    tempConfig.waitSecond = Number(DOM.waitSecondInput.value) || 10;
    tempConfig.openNewTab = DOM.globalNewTabSwitch.checked;
    tempConfig.adminPwd = adminPassword;
    onlineConfig = deepClone(tempConfig); tempConfig = deepClone(onlineConfig);
    saveLocalConfig(); renderAll(); renderAdminDomainList(); renderEmbList(); resetCountdown(); updateJsonPreview();
    const jsonStr = JSON.stringify(onlineConfig, null, 2);
    try { await navigator.clipboard.writeText(jsonStr); } catch (e) {
        const ta = document.createElement("textarea"); ta.value = jsonStr;
        ta.style.cssText = "position:fixed;opacity:0;z-index:-9999"; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    const blob = new Blob([jsonStr], { type: "application/json" });
    const bUrl = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = bUrl; a.download = "config.json"; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(bUrl);
    localStorage.removeItem(HAS_EDITS_KEY); hasLocalEdits = false; updateEditsBadge();
    showToast("配置已保存，JSON 已复制到剪贴板并下载", "success", 4000);
}
DOM.addSaveExportBtn.addEventListener("click", addSaveAndExport);
DOM.addSaveExportBtn2.addEventListener("click", addSaveAndExport);

// ==================== 渲染 ====================
function renderHomeDomainList() {
    const w = DOM.homeDomainWrap; w.innerHTML = "";
    const list = [...onlineConfig.domainConfig].sort((a, b) => (Number(a.weight) || 1) - (Number(b.weight) || 1));
    const jumpHero = document.querySelector(".jump-hero");
    if (!list.length) {
        w.innerHTML = '<div class="domain-empty">暂无站点，请登录管理员添加</div>';
        currentSite = null;
        updateJumpBtnStatus();
        // 无站点时隐藏倒计时区域
        if (jumpHero) jumpHero.style.display = "none";
        return;
    }
    // 存在站点则显示倒计时区域
    if (jumpHero) jumpHero.style.display = "block";
    const frag = document.createDocumentFragment();
    list.forEach((s, i) => {
        const d = document.createElement("div"); d.className = "site-item" + (s.open ? "" : " close-state");
        if (currentSite && currentSite.id === s.id) d.classList.add("selected");
        d.style.animationDelay = i * .04 + "s";
        const row = document.createElement("div"); row.className = "site-row";
        const nm = document.createElement("span"); nm.className = "site-name"; nm.textContent = s.name;
        const tg = document.createElement("span"); tg.className = "site-tag " + (s.open ? "open" : "closed"); tg.textContent = s.open ? "已开放" : "未开放";
        row.appendChild(nm); row.appendChild(tg);
        const ur = document.createElement("div"); ur.className = "site-url"; ur.textContent = s.url;
        d.appendChild(row); d.appendChild(ur);
        d.addEventListener("click", () => selectSite(s.id)); frag.appendChild(d);
    });
    w.appendChild(frag);
}


function renderAdminDomainList() {
    const w = DOM.adminDomainWrap; w.innerHTML = "";
    if (!isAdminLogin) return;
    const list = [...tempConfig.domainConfig].sort((a, b) => (Number(a.weight) || 10) - (Number(b.weight) || 10));
    if (!list.length) { w.innerHTML = '<div class="domain-empty">暂无站点</div>'; return; }
    const frag = document.createDocumentFragment();
    list.forEach(s => {
        const d = document.createElement("div"); d.className = "site-item admin-item"; d.style.cursor = "default";
        const info = document.createElement("div"); info.className = "admin-item-info";
        const ne = document.createElement("div"); ne.className = "site-name"; ne.textContent = s.name + " | 权重:" + (s.weight || 1);
        const ue = document.createElement("div"); ue.className = "site-url"; ue.textContent = s.url;
        info.appendChild(ne); info.appendChild(ue);
        const act = document.createElement("div"); act.className = "admin-item-actions";
        const rg = document.createElement("div"); rg.style.cssText = "display:flex;gap:8px;font-size:12px";
        const mkR = (v, l, c) => { const lb = document.createElement("label"); lb.style.cssText = "color:" + c + ";cursor:pointer;display:flex;align-items:center;gap:3px"; const r = document.createElement("input"); r.type = "radio"; r.name = "stat_" + s.id; r.value = v; if ((v === "1" && s.open) || (v === "0" && !s.open)) r.checked = true; lb.appendChild(r); lb.appendChild(document.createTextNode(l)); return lb; };
        rg.appendChild(mkR("1", "开放", "var(--success)")); rg.appendChild(mkR("0", "关闭", "var(--danger)"));
        const eb = document.createElement("button"); eb.className = "btn btn-secondary btn-sm"; eb.textContent = "编辑"; eb.addEventListener("click", () => openEditSection(s));
        const db = document.createElement("button"); db.className = "btn btn-danger btn-sm"; db.textContent = "删除"; db.addEventListener("click", () => deleteSite(s.id));
        act.appendChild(rg); act.appendChild(eb); act.appendChild(db);
        d.appendChild(info); d.appendChild(act); frag.appendChild(d);
    });
    w.appendChild(frag);
}

function renderEmbList() {
    const w = DOM.embWrap; w.innerHTML = "";
    if (!tempConfig.embeddedPages || !tempConfig.embeddedPages.length) return;
    const frag = document.createDocumentFragment();
    tempConfig.embeddedPages.forEach(p => {
        const d = document.createElement("div"); d.className = "emb-item";
        const ns = document.createElement("span"); ns.className = "emb-item-name"; ns.textContent = p.name;
        const us = document.createElement("span"); us.className = "emb-item-url"; us.textContent = p.url;
        const db = document.createElement("button"); db.className = "btn btn-danger btn-sm"; db.style.cssText = "padding:3px 8px;font-size:11px"; db.textContent = "删除"; db.addEventListener("click", () => deleteEmb(p.id));
        d.appendChild(ns); d.appendChild(us); d.appendChild(db); frag.appendChild(d);
    });
    w.appendChild(frag);
}

async function deleteEmbeddedFrame(id) {
    const t = onlineConfig.embeddedPages.find(p => p.id === id);
    if (!t) return;
    if (!(await showConfirm("关闭内嵌网页", "确定关闭「" + t.name + "」？关闭后可在站点管理中重新添加。"))) return;
    onlineConfig.embeddedPages = onlineConfig.embeddedPages.filter(p => p.id !== id);
    tempConfig.embeddedPages = tempConfig.embeddedPages.filter(p => p.id !== id);
    saveLocalConfig();
    renderEmbeddedFrames();
    showToast("已关闭「" + t.name + "」", "success");
}

// 已修复：清除旧标题防重复 + 加载失败新增打开按钮
function renderEmbeddedFrames() {
    const sec = DOM.embeddedSection, tabs = DOM.embTabs, fw = DOM.embFrameWrap;
    const pages = onlineConfig.embeddedPages || [];
    if (!pages.length) { sec.style.display = "none"; return; }
    sec.style.display = "";
    tabs.innerHTML = "";
    fw.innerHTML = "";
    // 清除上次渲染残留标题，杜绝重复多行标题
    sec.querySelectorAll(".section-title").forEach(el => el.remove());

    // 仅生成1次标题
    const title = document.createElement("h3");
    title.className = "section-title";
    title.innerHTML = "&#128196; 预览内嵌网页";
    sec.insertBefore(title, tabs);

    pages.forEach((p, i) => {
        const tab = document.createElement("div"); tab.className = "emb-tab" + (i === 0 ? " active" : "");
        const tn = document.createElement("span"); tn.textContent = p.name;
        const cb = document.createElement("span"); cb.className = "emb-tab-close"; cb.textContent = " x";
        tab.appendChild(tn); tab.appendChild(cb);

        // 创建 iframe 容器
        const frameContainer = document.createElement("div");
        frameContainer.className = "emb-frame-container";
        frameContainer.style.display = i === 0 ? "block" : "none";

        // 加载提示
        const loading = document.createElement("div");
        loading.className = "emb-loading";
        loading.innerHTML = '<div class="emb-loading-spinner"></div><span>正在加载 ' + escapeHtml(p.name) + '...</span>';

        // 错误提示（新增新标签打开按钮）
        const errDiv = document.createElement("div");
        errDiv.className = "emb-load-error";
        errDiv.style.display = "none";
        errDiv.innerHTML = `
<div class="err-icon">&#9888;</div>
<div class="err-msg">页面加载失败或被目标网站拦截</div>
<div class="err-url">${escapeHtml(p.url)}</div>
<div class="err-hint">该网站可能禁止在 iframe 中嵌入，请在浏览器中直接打开</div>
<button onclick="window.open('${escapeHtml(p.url)}','_blank')" style="margin-top:8px;padding:6px 12px;background:#2563eb;color:#fff;border:none;border-radius:4px;">新标签打开原页面</button>
`;

        const ifr = document.createElement("iframe"); ifr.src = p.url;
        ifr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
        ifr.setAttribute("loading", "lazy");
        ifr.setAttribute("referrerpolicy", "no-referrer");
        ifr.setAttribute("title", p.name);

        ifr.addEventListener("load", () => {
            loading.classList.add("hidden");
            try {
                const doc = ifr.contentDocument || ifr.contentWindow.document;
                if (doc && doc.body && doc.body.innerHTML === "") {
                    errDiv.style.display = "flex";
                }
            } catch (e) {}
        });

        ifr.addEventListener("error", () => {
            loading.classList.add("hidden");
            errDiv.style.display = "flex";
        });

        setTimeout(() => {
            if (!loading.classList.contains("hidden")) {
                loading.classList.add("hidden");
                errDiv.style.display = "flex";
            }
        }, 15000);

        tab.addEventListener("click", e => {
            if (e.target === cb) {
                deleteEmbeddedFrame(p.id);
                return;
            }
            tabs.querySelectorAll(".emb-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            fw.querySelectorAll(".emb-frame-container").forEach((fc, fi) => {
                fc.style.display = fi === i ? "block" : "none";
            });
        });

        frameContainer.appendChild(loading);
        frameContainer.appendChild(errDiv);
        frameContainer.appendChild(ifr);
        tabs.appendChild(tab);
        fw.appendChild(frameContainer);
    });
}

function renderAll() {
    DOM.waitSecondInput.value = onlineConfig.waitSecond;
    DOM.globalNewTabSwitch.checked = onlineConfig.openNewTab;
    renderHomeDomainList(); updateJumpBtnStatus();
    if (isAdminLogin) renderEmbeddedFrames();
}



function autoSelectSiteOnLoad() {
    const lid = onlineConfig.lastSelectSiteId;
    if (lid) { const l = onlineConfig.domainConfig.find(s => s.id === lid && s.open); if (l) { selectSite(l.id); return; } }
    const t = getTopWeightOpenSite(); if (t) selectSite(t.id);
}

// ==================== 初始化 ====================
window.addEventListener("load", loadOnlineConfig);
window.addEventListener("offline", () => showToast("网络已断开", "warning"));
if (document.referrer) DOM.sourceTip.textContent = "来路：" + document.referrer;
document.addEventListener("keydown", e => { if (e.key === "Escape" && DOM.editSection.style.display !== "none") DOM.editSection.style.display = "none"; });
