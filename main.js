const STORAGE_KEY = "jump_config";
const LOGIN_STORAGE_KEY = "admin_is_login";
// 完整6套主题列表
const THEME_LIST = ["", "purple", "mint", "coral", "deepblue", "pink"];
// 默认基础配置（新增adminPwd字段，密码统一存在线上json，前端无硬编码密码）
const baseOnlineConfig = {
    waitSecond: 10,
    openNewTab: true,
    theme: "",
    lastSelectSiteId: "",
    repoUrl: "",
    adminPwd: "admin123",
    domainConfig: []
};
let onlineConfig = { ...baseOnlineConfig };
// 临时缓存（编辑时暂存，不点保存不写入本地）
let tempConfig = { ...baseOnlineConfig };
let onlineConfigLoaded = false;
let modalOpenPauseFlag = false;

// DOM元素缓存
const openAdminBtn = document.getElementById("openAdminBtn");
const adminModalMask = document.getElementById("adminModalMask");
const adminModalClose = document.getElementById("adminModalClose");
const loginArea = document.getElementById("loginArea");
const editArea = document.getElementById("editArea");
const logoutBtn = document.getElementById("logoutBtn");
const circleLoader = document.getElementById("circleLoader");
const themeSwitchBtn = document.getElementById("themeSwitchBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");

const countDom = document.getElementById("count-num");
const barDom = document.getElementById("progress-bar");
const pauseBtn = document.getElementById("pauseBtn");
const jumpBtn = document.getElementById("jumpBtn");
const homeDomainWrap = document.getElementById("homeDomainWrap");
const adminDomainWrap = document.getElementById("adminDomainWrap");
const canonicalTag = document.querySelector("link[rel='canonical']");
const adminPwdInput = document.getElementById("adminPwdInput");
const newPwdInput = document.getElementById("newPwdInput");
const loginBtn = document.getElementById("loginBtn");
const waitSecondInput = document.getElementById("waitSecondInput");
const globalNewTabSwitch = document.getElementById("globalNewTabSwitch");
const siteNameInput = document.getElementById("siteNameInput");
const siteUrlInput = document.getElementById("siteUrlInput");
const siteWeightInput = document.getElementById("siteWeightInput");
const addSiteBtn = document.getElementById("addSiteBtn");
const exportOnlineConfigBtn = document.getElementById("exportOnlineConfigBtn");
const sourceTip = document.getElementById("sourceTip");
const editModal = document.getElementById("editModal");
const editSiteId = document.getElementById("editSiteId");
const editNameInput = document.getElementById("editNameInput");
const editUrlInput = document.getElementById("editUrlInput");
const editWeightInput = document.getElementById("editWeightInput");
const editOpenCheck = document.getElementById("editOpenCheck");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");
const tipModal = document.getElementById("tipModal");
const closeTipBtn = document.getElementById("closeTipBtn");
const repoUrlInput = document.getElementById("repoUrlInput");
const syncRepoUrlBtn = document.getElementById("syncRepoUrlBtn");

let timer = null;
let count = 0;
let isPause = false;
let currentSite = null;
const params = window.location.search;
let isAdminLogin = localStorage.getItem(LOGIN_STORAGE_KEY) === "1";
// 前端移除硬编码密码，密码从线上config.json读取
let adminPassword = baseOnlineConfig.adminPwd;

// 切换主题逻辑
function switchTheme() {
    const now = onlineConfig.theme;
    let idx = THEME_LIST.indexOf(now);
    idx = (idx + 1) % THEME_LIST.length;
    const newTheme = THEME_LIST[idx];
    onlineConfig.theme = newTheme;
    tempConfig.theme = newTheme;
    saveLocalConfig();
    document.documentElement.setAttribute("data-theme", newTheme);
}
themeSwitchBtn.addEventListener("click", switchTheme);

// 页面初始化加载保存的主题
function applySavedTheme() {
    const saved = onlineConfig.theme;
    document.documentElement.setAttribute("data-theme", saved);
}

// 【核心】点击保存按钮，临时缓存写入正式配置并持久化，保存后自动刷新面板数据
function doSaveConfig() {
    // 1. 读取当前面板所有编辑内容存入临时缓存
    tempConfig.waitSecond = Number(waitSecondInput.value) || 10;
    tempConfig.openNewTab = globalNewTabSwitch.checked;
    tempConfig.repoUrl = repoUrlInput.value.trim();
    tempConfig.adminPwd = adminPassword;

    // 2. 临时配置完整同步到全局onlineConfig（导出数据源）
    onlineConfig = JSON.parse(JSON.stringify(tempConfig));

    // 3. 强制刷新弹窗临时缓存，保存后弹窗立刻显示最新站点，无需关闭重开
    tempConfig = JSON.parse(JSON.stringify(onlineConfig));

    // 4. 本地持久化存储，刷新页面不丢失数据
    saveLocalConfig();

    // 5. 首页、管理员面板同步刷新渲染
    renderAll();
    renderAdminDomainList();
    resetCountdown();

    alert("配置保存成功！当前面板已刷新，直接点导出即可复制完整站点JSON");
}
saveConfigBtn.addEventListener("click", doSaveConfig);

// 打开管理员弹窗时同步配置到表单
function syncConfigToTempAndForm() {
    tempConfig = JSON.parse(JSON.stringify(onlineConfig));
    waitSecondInput.value = tempConfig.waitSecond;
    globalNewTabSwitch.checked = tempConfig.openNewTab;
    repoUrlInput.value = tempConfig.repoUrl || "";
}

// 按钮水波纹效果
function createRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}
document.querySelectorAll("button").forEach(btn => btn.addEventListener("click", createRipple));

// 管理员弹窗开关
function openAdminModal() {
    // 拦截：线上配置还没加载完就打开面板，弹窗提示等待
    if (!onlineConfigLoaded) {
        alert("页面正在加载线上站点配置，请等待页面完全加载完成后，再打开管理员面板！");
        return;
    }
    adminModalMask.style.display = "flex";
    // 关键修复：每次打开管理员面板，完整复制线上公共配置到临时编辑缓存
    tempConfig = JSON.parse(JSON.stringify(onlineConfig));
    // 自动回填仓库地址、倒计时、新标签开关到输入框
    syncConfigToTempAndForm();
    // 重新渲染管理员站点列表，线上所有站点全部展示
    renderAdminDomainList();
    // 弹窗打开自动暂停倒计时（原有逻辑保留）
    if (!isPause) {
        modalOpenPauseFlag = true;
        isPause = true;
        pauseBtn.innerText = "恢复倒计时";
        circleLoader.classList.add("paused");
    }
}
function closeAdminModal() {
    adminModalMask.style.display = "none";
    if (modalOpenPauseFlag) {
        modalOpenPauseFlag = false;
        isPause = false;
        pauseBtn.innerText = "暂停倒计时";
        circleLoader.classList.remove("paused");
    }
}
adminModalClose.addEventListener("click", closeAdminModal);
openAdminBtn.addEventListener("click", openAdminModal);

// 同步仓库地址（仅临时缓存）
syncRepoUrlBtn.addEventListener("click", ()=>{
    const url = repoUrlInput.value.trim();
    tempConfig.repoUrl = url;
    alert("仓库地址已临时缓存，点击【保存配置】才会永久写入配置文件");
});

// 工具函数：URL校验
function isValidUrl(url) {
    return /^https?:\/\/.+/.test(url.trim());
}
// 校验域名重复
function isUrlDuplicate(url, excludeId = null) {
    return tempConfig.domainConfig.some(item => item.url === url && item.id !== excludeId);
}
// 生成唯一站点ID
function genSiteId() {
    return "site_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

// 获取权重最高的开放站点（自动优先跳转）
function getTopWeightOpenSite() {
    const openList = onlineConfig.domainConfig.filter(s => s.open);
    if (openList.length === 0) return null;
    openList.sort((a, b) => Number(a.weight || 1) - Number(b.weight || 10));
    return openList[0];
}

// 页面加载自动选中上次站点
function autoSelectSiteOnLoad() {
    const lastId = onlineConfig.lastSelectSiteId;
    if (lastId) {
        const last = onlineConfig.domainConfig.find(s => s.id === lastId && s.open);
        if (last) {
            selectSite(last.id);
            return;
        }
    }
    const topSite = getTopWeightOpenSite();
    if (topSite) selectSite(topSite.id);
}

// 加载线上config.json，带字段校验、异常提示
async function loadOnlineConfig() {
    // 页面初始显示加载提示，避免空白站点
    homeDomainWrap.innerHTML = "<div class='domain-empty'>正在加载线上站点配置...</div>";
    try {
        const res = await fetch("./config.json?t=" + Date.now());
        if (!res.ok) throw new Error("文件不存在或404");
        const rawData = await res.json();
        // 补全缺失字段，防止残缺配置报错
        const fullData = { ...baseOnlineConfig };
        Object.keys(baseOnlineConfig).forEach(key => {
            if (rawData.hasOwnProperty(key)) fullData[key] = rawData[key];
        });
        // 线上配置成功，直接覆盖全局配置
        onlineConfig = fullData;
        adminPassword = onlineConfig.adminPwd;
        onlineConfigLoaded = true;
        console.log("线上配置加载成功");
    } catch (e) {
        alert(`加载线上config.json失败：${e.message}\n将使用浏览器本地缓存配置`);
        // 仅线上加载失败时，才读取本地缓存兜底
        loadLocalConfig();
    }
    // 同步到编辑临时缓存
    tempConfig = JSON.parse(JSON.stringify(onlineConfig));
    // 应用主题、渲染页面、自动选站点、启动倒计时
    applySavedTheme();
    renderAll();
    autoSelectSiteOnLoad();
    resetCountdown();
}

// 读取本地缓存配置（仅线上加载失败才执行）
function loadLocalConfig() {
    const cacheStr = localStorage.getItem(STORAGE_KEY);
    if (!cacheStr) return;
    try {
        const localData = JSON.parse(cacheStr);
        Object.keys(baseOnlineConfig).forEach(key => {
            if (localData.hasOwnProperty(key)) onlineConfig[key] = localData[key];
        });
        adminPassword = onlineConfig.adminPwd;
    } catch (err) {
        console.warn("本地缓存解析失败，使用默认配置", err);
    }
}

// 保存配置到本地localStorage
function saveLocalConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        waitSecond: onlineConfig.waitSecond,
        openNewTab: onlineConfig.openNewTab,
        theme: onlineConfig.theme,
        lastSelectSiteId: onlineConfig.lastSelectSiteId,
        repoUrl: onlineConfig.repoUrl,
        adminPwd: onlineConfig.adminPwd,
        domainConfig: onlineConfig.domainConfig
    }));
}

// 导出配置：读取tempConfig，保存后立刻导出必有站点，取消自动下载config.json文件
async function exportOnlineConfigFile() {
    // 读取当前最新编辑缓存，刚保存/新增站点直接导出，不受线上空白配置影响
    const jsonStr = JSON.stringify(tempConfig, null, 2);
    // 复制文本到剪贴板
    try {
        await navigator.clipboard.writeText(jsonStr);
    } catch (err) {
        // 剪贴板复制失败，弹出全部文本手动复制
        alert("自动复制剪贴板失败，请手动复制下方全部文本：\n\n" + jsonStr);
        return;
    }
    // 弹出提示弹窗
    tipModal.style.display = "flex";
    const repo = onlineConfig.repoUrl.trim();
    if (repo && isValidUrl(repo)) {
        // 延迟打开仓库编辑页面，方便直接粘贴
        setTimeout(()=>window.open(repo, "_blank"), 500);
    }
}
closeTipBtn.addEventListener("click", () => tipModal.style.display = "none");
exportOnlineConfigBtn.addEventListener("click", exportOnlineConfigFile);

// 管理员登录
function doLogin() {
    const p = adminPwdInput.value.trim();
    if (p === adminPassword) {
        isAdminLogin = true;
        localStorage.setItem(LOGIN_STORAGE_KEY, "1");
        loginArea.style.display = "none";
        editArea.style.display = "block";
        // 登录成功强制同步线上完整站点、仓库配置到编辑缓存
        tempConfig = JSON.parse(JSON.stringify(onlineConfig));
        syncConfigToTempAndForm();
        renderAll();
        renderAdminDomainList();
        alert("登录成功！已加载线上全部站点与仓库配置");
    } else {
        alert("密码错误，请核对仓库config.json内的adminPwd密码");
    }
}
loginBtn.addEventListener("click", doLogin);
// 登出管理员
function logoutAdmin() {
    isAdminLogin = false;
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    loginArea.style.display = "block";
    editArea.style.display = "none";
    adminPwdInput.value = "";
    closeAdminModal();
    alert("已登出管理员面板");
}
logoutBtn.addEventListener("click", logoutAdmin);
// 临时修改管理员密码
function changeAdminPassword() {
    const p = newPwdInput.value.trim();
    if (!p) return alert("密码不能为空");
    adminPassword = p;
    newPwdInput.value = "";
    alert("密码仅当前页面临时生效，点击【保存配置】导出文件后永久存入config.json");
}

// 添加站点（仅临时缓存）
function addNewSite() {
    const name = siteNameInput.value.trim();
    const url = siteUrlInput.value.trim();
    const weight = Number(siteWeightInput.value) || 1;
    if (!name || !url) return alert("名称、链接不能为空");
    if (!isValidUrl(url)) return alert("链接必须 http/https 开头");
    if (isUrlDuplicate(url)) return alert("该域名已存在");
    tempConfig.domainConfig.push({
        id: genSiteId(),
        name,
        url,
        weight,
        open: false
    });
    siteNameInput.value = "";
    siteUrlInput.value = "";
    siteWeightInput.value = "1";
    renderAdminDomainList();
    alert("站点已临时缓存，点击【保存配置】永久生效");
}
addSiteBtn.addEventListener("click", addNewSite);

// 删除站点（仅临时缓存）
function deleteSite(siteId) {
    const t = tempConfig.domainConfig.find(s => s.id === siteId);
    if (!t) return;
    if (!confirm(`删除站点【${t.name}】？`)) return;
    tempConfig.domainConfig = tempConfig.domainConfig.filter(i => i.id !== siteId);
    renderAdminDomainList();
    alert("删除已临时缓存，点击【保存配置】永久生效");
}

// 打开编辑站点弹窗
function openEditModal(site) {
    editSiteId.value = site.id;
    editNameInput.value = site.name;
    editUrlInput.value = site.url;
    editWeightInput.value = Number(site.weight || 1);
    editOpenCheck.checked = site.open;
    editModal.style.display = "flex";
}
modalCancel.addEventListener("click", () => editModal.style.display = "none");

// 保存编辑站点到临时缓存
function saveEditSite() {
    const sid = editSiteId.value;
    const name = editNameInput.value.trim();
    const url = editUrlInput.value.trim();
    const weight = Number(editWeightInput.value) || 10;
    const open = editOpenCheck.checked;
    if (!name || !url) return alert("名称、链接不能为空");
    if (!isValidUrl(url)) return alert("链接必须 http/https 开头");
    if (isUrlDuplicate(url, sid)) return alert("域名已被其他站点占用");
    const item = tempConfig.domainConfig.find(s => s.id === sid);
    if (!item) return;
    item.name = name;
    item.url = url;
    item.weight = weight;
    item.open = open;
    editModal.style.display = "none";
    renderAdminDomainList();
    alert("修改已临时缓存，点击【保存配置】永久生效");
}
modalSave.addEventListener("click", saveEditSite);

// 切换站点开放/关闭状态
document.addEventListener("change", (e) => {
    const radio = e.target;
    if (radio.name?.startsWith("stat_")) {
        const siteId = radio.name.replace("stat_", "");
        const site = tempConfig.domainConfig.find(s => s.id === siteId);
        if (site) site.open = radio.value === "1";
    }
});

// 选中站点
function selectSite(siteId) {
    const t = onlineConfig.domainConfig.find(s => s.id === siteId);
    if (!t) return;
    currentSite = t;
    onlineConfig.lastSelectSiteId = siteId;
    tempConfig.lastSelectSiteId = siteId;
    saveLocalConfig();
    updateCanonical();
    updateJumpBtnStatus();
    resetCountdown();
    renderHomeDomainList();
}

// 更新立即跳转按钮禁用状态
function updateJumpBtnStatus() {
    jumpBtn.disabled = !(currentSite && currentSite.open);
}
// 拼接跳转链接
function getJumpUrl() {
    return currentSite.url + params;
}
// 更新规范链接标签
function updateCanonical() {
    if (canonicalTag) canonicalTag.href = currentSite ? getJumpUrl() : "";
}
// 执行跳转
function goJump() {
    if (!currentSite || !currentSite.open) {
        alert("站点未开放，无法自动跳转");
        return;
    }
    clearInterval(timer);
    const u = getJumpUrl();
    if (onlineConfig.openNewTab) window.open(u, "_blank");
    else location.href = u;
}
jumpBtn.addEventListener("click", goJump);

// 重置倒计时
function resetCountdown() {
    clearInterval(timer);
    isPause = false;
    modalOpenPauseFlag = false;
    pauseBtn.innerText = "暂停倒计时";
    count = Number(onlineConfig.waitSecond);
    countDom.innerText = count;
    barDom.style.width = "0%";
    circleLoader.classList.remove("paused");
    startTimer();
}
// 倒计时定时器
function startTimer() {
    timer = setInterval(() => {
        if (!currentSite || !currentSite.open || isPause) return;
        count--;
        countDom.innerText = count;
        const total = onlineConfig.waitSecond;
        const pct = ((total - count) / total) * 100;
        barDom.style.width = pct + "%";
        if (count <= 0) {
            clearInterval(timer);
            goJump();
        }
    }, 1000);
}
// 暂停/恢复倒计时
pauseBtn.addEventListener("click", () => {
    if (modalOpenPauseFlag) return;
    isPause = !isPause;
    pauseBtn.innerText = isPause ? "恢复倒计时" : "暂停倒计时";
    circleLoader.classList.toggle("paused", isPause);
});

// 渲染首页站点列表
function renderHomeDomainList() {
    homeDomainWrap.innerHTML = "";
    let list = [...onlineConfig.domainConfig];
    list.sort((a, b) => Number(a.weight || 1) - Number(b.weight || 10));
    if (list.length === 0) {
        homeDomainWrap.innerHTML = `<div class="domain-empty">暂无站点，请登录管理员添加</div>`;
        currentSite = null;
        return;
    }
    list.forEach(site => {
        const div = document.createElement("div");
        div.className = "home-domain-item " + (site.open ? "" : "close-state");
        div.dataset.id = site.id;
        if (currentSite && currentSite.id === site.id) div.classList.add("selected");
        div.innerHTML = `
            <div class="home-name-row">
                <span class="domain-name">${site.name}</span>
                <span class="${site.open ? 'domain-status-tag-open' : 'domain-status-tag-close'}">${site.open ? '已开放' : '未开放'}</span>
            </div>
            <div class="domain-url">${site.url}</div>
        `;
        div.addEventListener("click", () => selectSite(site.id));
        homeDomainWrap.appendChild(div);
    })
}

// 渲染管理员面板站点列表
function renderAdminDomainList() {
    adminDomainWrap.innerHTML = "";
    if (!isAdminLogin || tempConfig.domainConfig.length === 0) return;
    const title = document.createElement("div");
    title.className = "admin-domain-title";
    title.innerText = "站点列表（权重数字越小，排队越靠前、自动优先跳转）";
    adminDomainWrap.appendChild(title);
    let list = [...tempConfig.domainConfig];
    list.sort((a,b)=>Number(a.weight||10)-Number(b.weight||10));
    list.forEach(site => {
        const item = document.createElement("div");
        item.className = "admin-domain-item";
        item.dataset.id = site.id;
        item.innerHTML = `
            <div class="admin-domain-info">
                <div class="domain-name">${site.name} | 排队序号权重:${site.weight || 1}</div>
                <div class="domain-url">${site.url}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
                <div class="status-radio-group">
                    <label class="radio-open">
                        <input type="radio" name="stat_${site.id}" value="1" ${site.open?"checked":""}>开放
                    </label>
                    <label class="radio-close">
                        <input type="radio" name="stat_${site.id}" value="0" ${!site.open?"checked":""}>关闭
                    </label>
                </div>
                <div class="domain-op-btn-group">
                    <button class="edit-site-btn" data-id="${site.id}">编辑</button>
                    <button class="del-site-btn" data-id="${site.id}">删除</button>
                </div>
            </div>
        `;
        adminDomainWrap.appendChild(item);
        const editBtn = item.querySelector(".edit-site-btn");
        const delBtn = item.querySelector(".del-site-btn");
        editBtn.onclick = ()=>openEditModal(site);
        delBtn.onclick = ()=>deleteSite(site.id);
    })
}

// 全局统一渲染所有页面模块
function renderAll() {
    waitSecondInput.value = onlineConfig.waitSecond;
    globalNewTabSwitch.checked = onlineConfig.openNewTab;
    repoUrlInput.value = onlineConfig.repoUrl || "";
    loginArea.style.display = isAdminLogin ? "none" : "block";
    editArea.style.display = isAdminLogin ? "block" : "none";
    renderHomeDomainList();
    updateJumpBtnStatus();
}

// 页面加载完成后初始化（修改：直接执行异步加载函数，先拉线上配置再渲染）
window.addEventListener("load", loadOnlineConfig);
// 离线提示
window.addEventListener("offline", ()=>alert("网络断开，无法加载线上配置"));
// 来路记录
if (document.referrer) sourceTip.innerText = "来路页面：" + document.referrer;
