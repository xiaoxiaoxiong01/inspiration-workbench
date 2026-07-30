/**
 * app.js — 应用主逻辑
 * 路由、页面渲染、交互
 */

// ===== 全局状态 =====
const state = {
  currentPage: 'home',
  currentMaterialFilter: { tag: '全部', search: '' },
  currentNoteFolder: null,
  currentBookFilter: '全部',
  currentInspTag: '全部',
  editingNote: null,
  deferredInstallPrompt: null
};

// ===== 工具函数 =====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = 60000, hour = 3600000, day = 86400000;
  if (diff < min) return '刚刚';
  if (diff < hour) return Math.floor(diff / min) + '分钟前';
  if (diff < day) return Math.floor(diff / hour) + '小时前';
  if (diff < day * 7) return Math.floor(diff / day) + '天前';
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function getWeekRange(ts) {
  const d = new Date(ts);
  const day = d.getDay() || 7; // 周日=7
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.getTime(), end: sunday.getTime() };
}
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// 素材类型配置
const MATERIAL_TYPES = {
  image: { label: '图片', icon: '📷', badge: '图片' },
  video: { label: '视频', icon: '🎬', badge: '视频' },
  bgm: { label: 'BGM', icon: '🎵', badge: 'BGM' },
  link: { label: '链接', icon: '🔗', badge: '链接' },
  text: { label: '文字', icon: '✏️', badge: '文字' }
};

const COVER_HEIGHTS = ['h1', 'h2', 'h3', 'h4'];
const COVER_COLORS = ['c1', 'c2', 'c3', 'c4'];

// ===== 路由 =====
function go(page, params = {}) {
  state.currentPage = page;
  state.pageParams = params;
  renderPage();
  closeDrawer();
  window.scrollTo(0, 0);
  // 更新hash
  history.replaceState(null, '', '#' + page);
}

function renderPage() {
  const app = $('#app');
  const page = state.currentPage;
  let html = '';
  switch (page) {
    case 'home': html = renderHome(); break;
    case 'inspiration': html = renderInspiration(); break;
    case 'search': html = renderSearchPage(); break;
    case 'material': html = renderMaterial(); break;
    case 'materialDetail': html = renderMaterialDetail(state.pageParams?.id); break;
    case 'note': html = renderNote(); break;
    case 'noteEdit': html = renderNoteEdit(state.pageParams?.id); break;
    case 'reading': html = renderReading(); break;
    case 'bookDetail': html = renderBookDetail(state.pageParams?.id); break;
    case 'todo': html = renderTodo(); break;
    case 'schedule': html = renderSchedule(); break;
    case 'settings': html = renderSettings(); break;
    default: html = renderHome();
  }
  app.innerHTML = html;
  // 页面后置初始化
  if (page === 'material') initMaterialPage();
  if (page === 'note') initNotePage();
  if (page === 'reading') initReadingPage();
  if (page === 'inspiration') initInspirationPage();
  if (page === 'noteEdit') initNoteEditPage();
  if (page === 'todo') initTodoPage();
  if (page === 'home') initHomePage();
  if (page === 'settings') initSettingsPage();
  updateNavActive();
}

function updateNavActive() {
  const page = state.currentPage;
  const navMap = { home: 0, inspiration: 1, material: 2, note: 3, reading: 4, search: 1, materialDetail: 2, noteEdit: 3, bookDetail: 4 };
  $$('.nav-item').forEach((n, i) => n.classList.toggle('active', i === navMap[page]));
  const drawerMap = { home: 0, inspiration: 1, material: 2, note: 3, reading: 4, todo: 5, schedule: 6, settings: 7 };
  $$('.drawer-item').forEach((d, i) => d.classList.toggle('active', i === drawerMap[page]));
}

// ===== 抽屉 =====
function openDrawer() { $('#drawer').classList.add('open'); $('#drawerOverlay').classList.add('open'); }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerOverlay').classList.remove('open'); }

// ===== 主页 =====
function renderHome() {
  return `
    <div class="page active" id="page-home">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">今天</div>
        <button class="top-action" onclick="openMaterialAddSheet()">＋</button>
      </div>
      <div class="home-greeting">
        <h1>${getGreeting()} ✨</h1>
        <p id="homeDateText">加载中…</p>
      </div>
      <div class="home-widgets">
        <div class="widget-card peach" onclick="go('todo')">
          <div class="widget-icon">☑️</div>
          <div class="widget-title">今日待办</div>
          <div class="widget-value" id="widgetTodo">-<span class="unit">/-</span></div>
          <div class="widget-sub" id="widgetTodoSub">加载中</div>
        </div>
        <div class="widget-card blue" onclick="go('schedule')">
          <div class="widget-icon">📅</div>
          <div class="widget-title">今日日程</div>
          <div class="widget-value" id="widgetSchedule">-</div>
          <div class="widget-sub" id="widgetScheduleSub">加载中</div>
        </div>
        <div class="widget-card lavender" onclick="go('reading')">
          <div class="widget-icon">📚</div>
          <div class="widget-title">本周阅读</div>
          <div class="widget-value" id="widgetReading">-<span class="unit"> 条摘抄</span></div>
          <div class="widget-trend" id="widgetReadingTrend">加载中</div>
        </div>
        <div class="widget-card peach" onclick="go('material')">
          <div class="widget-icon">📦</div>
          <div class="widget-title">素材库</div>
          <div class="widget-value" id="widgetMaterial">-</div>
          <div class="widget-sub" id="widgetMaterialSub">加载中</div>
        </div>
      </div>
      <div class="section-title">最近添加的素材 <span class="more" onclick="go('material')">查看全部 ›</span></div>
      <div class="h-scroll" id="homeRecentMaterials"></div>
      <div class="section-title">最近收藏流 <span class="more" onclick="go('inspiration')">查看更多 ›</span></div>
      <div class="insp-feed" id="homeRecentFeed"></div>
    </div>
  `;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

async function initHomePage() {
  const now = Date.now();
  const today = todayStr();
  const d = new Date();
  const weekdays = ['日','一','二','三','四','五','六'];
  $('#homeDateText').textContent = `今天是 ${d.getMonth()+1}月${d.getDate()}日 周${weekdays[d.getDay()]}`;

  // 待办统计
  const todos = await DB.getAll('todos');
  const todayTodos = todos.filter(t => t.date === today);
  const doneCount = todayTodos.filter(t => t.done).length;
  $('#widgetTodo').innerHTML = `${doneCount}<span class="unit">/${todayTodos.length}</span>`;
  $('#widgetTodoSub').textContent = todayTodos.length - doneCount > 0 ? `还有 ${todayTodos.length - doneCount} 项未完成` : '全部完成啦 🎉';

  // 日程统计
  const schedules = await DB.getAll('schedules');
  const todaySchedules = schedules.filter(s => s.date === today).sort((a,b) => a.time.localeCompare(b.time));
  $('#widgetSchedule').textContent = todaySchedules.length;
  const next = todaySchedules.find(s => !s.done);
  $('#widgetScheduleSub').textContent = next ? `下一项 ${next.time} ${next.title}` : '今日无更多日程';

  // 阅读统计
  const excerpts = await DB.getAll('excerpts');
  const thisWeek = getWeekRange(now);
  const lastWeek = { start: thisWeek.start - 86400000 * 7, end: thisWeek.start - 1 };
  const thisWeekCount = excerpts.filter(e => e.createdAt >= thisWeek.start && e.createdAt <= thisWeek.end).length;
  const lastWeekCount = excerpts.filter(e => e.createdAt >= lastWeek.start && e.createdAt <= lastWeek.end).length;
  $('#widgetReading').innerHTML = `${thisWeekCount}<span class="unit"> 条摘抄</span>`;
  const trend = lastWeekCount === 0 ? '本周开始记录' : `↑ 上周 ${lastWeekCount} 条 · +${Math.round((thisWeekCount - lastWeekCount) / lastWeekCount * 100)}%`;
  $('#widgetReadingTrend').textContent = thisWeekCount >= lastWeekCount ? trend : `↓ 上周 ${lastWeekCount} 条`;

  // 素材统计
  const materials = await DB.getAll('materials');
  $('#widgetMaterial').textContent = materials.length;
  const todayMaterials = materials.filter(m => m.createdAt > now - 86400000);
  $('#widgetMaterialSub').textContent = todayMaterials.length > 0 ? `今日新增 ${todayMaterials.length} 条` : '点击右上角添加';

  // 最近素材横滑
  const recentMaterials = materials.sort((a,b) => b.createdAt - a.createdAt).slice(0, 6);
  const recentHtml = recentMaterials.length === 0
    ? '<div style="padding:10px 16px;color:var(--text-light);font-size:13px;">还没有素材，点右上角添加吧</div>'
    : recentMaterials.map(m => {
      const t = MATERIAL_TYPES[m.type] || MATERIAL_TYPES.text;
      const colorIdx = m.title ? m.title.charCodeAt(0) % 4 : 0;
      return `<div class="recent-item" onclick="go('materialDetail',{id:'${m.id}'})">
        <div class="recent-thumb" style="background:${getCoverBg(colorIdx)}">${t.icon}</div>
        <div class="recent-info"><div class="recent-title">${escapeHtml(m.title)}</div><div class="recent-tag">${t.badge}${m.sourcePlatform ? ' · ' + m.sourcePlatform : ''}</div></div>
      </div>`;
    }).join('');
  $('#homeRecentMaterials').innerHTML = recentHtml;

  // 最近收藏流
  const feedMaterials = materials.sort((a,b) => b.createdAt - a.createdAt).slice(0, 3);
  const feedHtml = feedMaterials.length === 0
    ? '<div style="padding:10px 0;color:var(--text-light);font-size:13px;">还没有收藏，去素材库添加吧</div>'
    : feedMaterials.map(m => renderInspCard(m)).join('');
  $('#homeRecentFeed').innerHTML = feedHtml;
}

function getCoverBg(idx) {
  const bgs = [
    'linear-gradient(135deg,var(--peach-light),var(--peach))',
    'linear-gradient(135deg,var(--mist-blue-light),var(--mist-blue))',
    'linear-gradient(135deg,var(--lavender-light),var(--lavender))',
    'linear-gradient(135deg,#FFD9C4,var(--lavender))'
  ];
  return bgs[idx % 4];
}

function renderInspCard(m) {
  const t = MATERIAL_TYPES[m.type] || MATERIAL_TYPES.text;
  const colorIdx = m.title ? m.title.charCodeAt(0) % 4 : 0;
  const coverClass = `c${colorIdx + 1}`;
  return `<div class="insp-card" onclick="go('materialDetail',{id:'${m.id}'})">
    <div class="insp-cover ${coverClass}">
      ${t.icon}
      ${m.sourcePlatform ? `<span class="insp-platform">${m.sourcePlatform}</span>` : ''}
      ${m.tags && m.tags.length ? `<span class="insp-heat">🏷️ ${m.tags.length}个标签</span>` : ''}
    </div>
    <div class="insp-body">
      <div class="insp-title">${escapeHtml(m.title || '未命名素材')}</div>
      ${m.note ? `<div class="insp-reason">${escapeHtml(m.note)}</div>` : ''}
      <div class="insp-actions">
        <button class="insp-btn insp-btn-detail" onclick="event.stopPropagation();go('materialDetail',{id:'${m.id}'})">查看详情</button>
      </div>
    </div>
  </div>`;
}

// ===== 灵感广场 =====
function renderInspiration() {
  return `
    <div class="page active" id="page-inspiration">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">灵感广场</div>
        <button class="top-action" onclick="go('search')">🔍</button>
      </div>
      <div class="search-bar" onclick="go('search')">
        <span class="s-icon">🔍</span>
        <input placeholder="搜索素材、备注、标签…" readonly>
      </div>
      <div class="insp-tabs" id="inspTabs">
        <div class="insp-tab active" data-tag="全部">全部</div>
        <div class="insp-tab" data-tag="图片">📷 图片</div>
        <div class="insp-tab" data-tag="视频">🎬 视频</div>
        <div class="insp-tab" data-tag="BGM">🎵 BGM</div>
        <div class="insp-tab" data-tag="链接">🔗 链接</div>
        <div class="insp-tab" data-tag="文字">✏️ 文字</div>
      </div>
      <div class="insp-feed" id="inspFeed"></div>
    </div>
  `;
}

async function initInspirationPage() {
  const materials = await DB.getAll('materials');
  const tag = state.currentInspTag;
  let filtered = materials.sort((a,b) => b.createdAt - a.createdAt);
  if (tag !== '全部') {
    const typeMap = { '图片': 'image', '视频': 'video', 'BGM': 'bgm', '链接': 'link', '文字': 'text' };
    const typeVal = typeMap[tag];
    filtered = filtered.filter(m => m.type === typeVal);
  }
  const html = filtered.length === 0
    ? '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">还没有素材<br>去素材库添加吧</div></div>'
    : filtered.map(m => renderInspCard(m)).join('');
  $('#inspFeed').innerHTML = html;

  // Tab点击
  $$('#inspTabs .insp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#inspTabs .insp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentInspTag = tab.dataset.tag;
      initInspirationPage();
    });
  });
}

// ===== 搜索页 =====
function renderSearchPage() {
  return `
    <div class="page active" id="page-search">
      <div class="top-bar">
        <button class="menu-btn" onclick="go('inspiration')">←</button>
        <div class="top-title">搜索</div>
      </div>
      <div style="padding:16px">
        <div class="search-bar" style="margin:0;box-shadow:none;border:1px solid rgba(195,177,225,.2)">
          <span class="s-icon">🔍</span>
          <input id="searchInput" placeholder="搜索标题、备注、标签…" autofocus>
        </div>
      </div>
      <div class="insp-feed" id="searchResults" style="padding-top:8px"></div>
    </div>
  `;
}

// ===== 素材库 =====
function renderMaterial() {
  return `
    <div class="page active" id="page-material">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">素材库</div>
        <button class="top-action" onclick="openMaterialAddSheet()">＋</button>
      </div>
      <div class="material-toolbar">
        <div class="material-search">
          <span style="font-size:16px;opacity:.5">🔍</span>
          <input id="materialSearchInput" placeholder="搜索备注、标签、标题…">
        </div>
      </div>
      <div class="insp-tabs" id="materialTags"></div>
      <div class="section-title" style="margin-top:8px">合集</div>
      <div class="material-collections" id="materialCollections"></div>
      <div class="section-title">全部素材 <span class="more" id="materialCount"></span></div>
      <div class="waterfall" id="materialWaterfall"></div>
      <div class="fab" onclick="openMaterialAddSheet()">＋</div>
    </div>
  `;
}

async function initMaterialPage() {
  const materials = await DB.getAll('materials');
  const collections = await DB.getAll('collections');

  // 收集所有标签
  const allTags = new Set();
  materials.forEach(m => (m.tags || []).forEach(t => allTags.add(t)));
  const tagsList = ['全部', ...Array.from(allTags)];

  // 渲染标签
  const tag = state.currentMaterialFilter.tag;
  $('#materialTags').innerHTML = tagsList.map(t =>
    `<div class="insp-tab ${t === tag ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</div>`
  ).join('');
  $$('#materialTags .insp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.currentMaterialFilter.tag = tab.dataset.tag;
      initMaterialPage();
    });
  });

  // 渲染合集
  const colHtml = collections.map(c => {
    const count = materials.filter(m => m.collectionId === c.id).length;
    const colorIdx = (c.name || '').charCodeAt(0) % 3;
    return `<div class="collection-card ${['','alt','alt2'][colorIdx]}" onclick="filterByCollection('${c.id}')" style="position:relative">
      <div class="collection-name">${c.icon || '📁'} ${escapeHtml(c.name)} <span style="font-size:12px;opacity:.5;cursor:pointer" onclick="event.stopPropagation();openEditCollectionSheet('${c.id}')">✏️</span></div>
      <div class="collection-count">${count} 条素材</div>
    </div>`;
  }).join('') + `<div class="collection-card" style="background:#fff;border:2px dashed var(--lavender-light)" onclick="openNewCollectionSheet()"><div class="collection-name" style="color:var(--text-secondary)">＋ 新建</div><div class="collection-count">自定义合集</div></div>`;
  $('#materialCollections').innerHTML = colHtml;

  // 过滤素材
  let filtered = materials.sort((a,b) => b.createdAt - a.createdAt);
  if (state.currentMaterialFilter.collectionId) {
    filtered = filtered.filter(m => m.collectionId === state.currentMaterialFilter.collectionId);
  }
  if (tag !== '全部') {
    filtered = filtered.filter(m => (m.tags || []).includes(tag));
  }
  const search = state.currentMaterialFilter.search;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(m =>
      (m.title || '').toLowerCase().includes(s) ||
      (m.note || '').toLowerCase().includes(s) ||
      (m.tags || []).some(t => t.toLowerCase().includes(s))
    );
  }

  let countText = `${filtered.length} 条`;
  if (state.currentMaterialFilter.collectionId) {
    const col = collections.find(c => c.id === state.currentMaterialFilter.collectionId);
    if (col) countText = `${filtered.length} 条 · 在「${col.name}」中 <span style="color:var(--lavender);cursor:pointer;font-weight:600" onclick="clearCollectionFilter()">× 清除筛选</span>`;
  }
  $('#materialCount').innerHTML = countText;

  // 瀑布流
  const html = filtered.length === 0
    ? '<div class="empty-state" style="column-span:all"><div class="empty-state-icon">📭</div><div class="empty-state-text">没有找到素材<br>试试其他筛选条件</div></div>'
    : filtered.map((m, i) => {
      const t = MATERIAL_TYPES[m.type] || MATERIAL_TYPES.text;
      const hIdx = i % 4;
      return `<div class="wf-item" onclick="go('materialDetail',{id:'${m.id}'})">
        <div class="wf-thumb ${COVER_HEIGHTS[hIdx]}" style="background:${getCoverBg(i % 4)}">${t.icon}<span class="wf-type-badge">${t.badge}</span></div>
        <div class="wf-info">
          <div class="wf-title">${escapeHtml(m.title || '未命名')}</div>
          <div class="wf-tags">${(m.tags || []).slice(0, 3).map(tg => `<span class="wf-mini-tag">${escapeHtml(tg)}</span>`).join('')}</div>
        </div>
      </div>`;
    }).join('');
  $('#materialWaterfall').innerHTML = html;

  // 搜索框
  const searchInput = $('#materialSearchInput');
  if (searchInput) {
    searchInput.value = state.currentMaterialFilter.search;
    searchInput.addEventListener('input', (e) => {
      state.currentMaterialFilter.search = e.target.value;
      clearTimeout(searchInput._timer);
      searchInput._timer = setTimeout(() => initMaterialPage(), 300);
    });
  }
}

function filterByCollection(colId) {
  // 切换到只显示该合集下的素材
  state.currentMaterialFilter.collectionId = colId;
  state.currentMaterialFilter.tag = '全部';
  initMaterialPage();
  showToast('已筛选该合集素材');
  // 滚动到素材列表
  setTimeout(() => {
    const wf = document.getElementById('materialWaterfall');
    if (wf) wf.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

function clearCollectionFilter() {
  state.currentMaterialFilter.collectionId = null;
  initMaterialPage();
}

// ===== 素材详情 =====
function renderMaterialDetail(id) {
  return `
    <div class="page active" id="page-materialDetail">
      <div class="top-bar">
        <button class="menu-btn" onclick="go('material')">←</button>
        <div class="top-title">素材详情</div>
        <button class="top-action" onclick="openMaterialEditSheet('${id}')">✏️</button>
      </div>
      <div id="materialDetailContent"></div>
      <div style="padding:0 16px 16px">
        <button class="btn-danger" onclick="deleteMaterial('${id}')">🗑️ 删除此素材</button>
      </div>
    </div>
  `;
}

async function renderMaterialDetailContent(id) {
  const m = await DB.get('materials', id);
  if (!m) { go('material'); return; }
  const t = MATERIAL_TYPES[m.type] || MATERIAL_TYPES.text;
  const colorIdx = m.title ? m.title.charCodeAt(0) % 4 : 0;

  let html = `<div class="detail-cover c${colorIdx + 1}">${t.icon}</div>`;

  html += `<div style="padding:16px 0">
    <div class="detail-section">
      <div style="font-size:17px;font-weight:700;margin-bottom:8px">${escapeHtml(m.title || '未命名素材')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="tag tag-lavender">${t.badge}</span>
        ${(m.tags || []).map(tg => `<span class="tag tag-peach">${escapeHtml(tg)}</span>`).join('')}
      </div>
    </div>`;

  // BGM 播放器
  if (m.type === 'bgm') {
    html += `<div class="detail-section">
      <div class="detail-label">🎵 音乐播放</div>
      <div class="bgm-player">
        <div class="bgm-cover">🎵</div>
        <div class="bgm-info">
          <div class="bgm-title">${escapeHtml(m.title || '未知音乐')}</div>
          <div class="bgm-source">来源：${escapeHtml(m.sourcePlatform || '未知')}</div>
        </div>
        <div class="bgm-play" onclick="playBgm('${id}')">▶</div>
      </div>
      ${m.sourceUrl ? `<div style="margin-top:10px"><a href="${escapeHtml(m.sourceUrl)}" target="_blank" rel="noopener" class="link-jump-btn" style="text-decoration:none;display:flex">🔗 跳转到${escapeHtml(m.sourcePlatform || '原平台')}播放 →</a></div>` : ''}
    </div>`;
  }

  // 备注
  if (m.note) {
    html += `<div class="detail-section"><div class="detail-label">📝 备注</div><div class="detail-content">${escapeHtml(m.note)}</div></div>`;
  }

  // 原始链接
  if (m.sourceUrl && m.type !== 'bgm') {
    html += `<div class="detail-section"><div class="detail-label">🔗 原始链接</div><a href="${escapeHtml(m.sourceUrl)}" target="_blank" rel="noopener" class="link-jump-btn" style="text-decoration:none;display:flex">🔗 打开原始内容 →</a></div>`;
  }

  // 文字内容
  if (m.type === 'text' && m.content) {
    html += `<div class="detail-section"><div class="detail-label">✏️ 文字内容</div><div class="detail-content">${escapeHtml(m.content)}</div></div>`;
  }

  // 添加日期
  html += `<div class="detail-section"><div class="detail-label">📅 添加日期</div><div class="detail-content">${formatDate(m.createdAt)}</div></div>`;

  // 合集
  if (m.collectionId) {
    const col = await DB.get('collections', m.collectionId);
    if (col) {
      html += `<div class="detail-section"><div class="detail-label">📂 所属合集</div><div class="detail-content">${col.icon || '📁'} ${escapeHtml(col.name)}</div></div>`;
    }
  }

  html += `</div>`;
  $('#materialDetailContent').innerHTML = html;
}

function openExternal(url) {
  if (!url) { showToast('没有链接'); return; }
  window.open(url, '_blank');
}

function playBgm(id) {
  // 尝试播放本地音频文件（如果有blob）
  showToast('点击下方"跳转播放"打开原平台播放');
}

async function deleteMaterial(id) {
  if (!confirm('确定删除这个素材吗？删除后无法恢复。')) return;
  await DB.delete('materials', id);
  showToast('已删除');
  go('material');
}

// ===== 笔记 =====
function renderNote() {
  return `
    <div class="page active" id="page-note">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">笔记 / 灵感记录</div>
        <button class="top-action" onclick="openNoteTypeSheet()">＋</button>
      </div>
      <div class="section-title" style="margin-top:12px">文件夹</div>
      <div class="h-scroll" id="noteFolders"></div>
      <div class="section-title">笔记列表 <span class="more" id="noteCount"></span></div>
      <div class="note-list" id="noteList"></div>
    </div>
  `;
}

async function initNotePage() {
  const folders = await DB.getAll('folders');
  const notes = await DB.getAll('notes');

  const folderId = state.currentNoteFolder;
  const folderHtml = `<div class="folder-chip ${!folderId ? 'active' : ''}" data-folder="">📂 全部</div>` +
    folders.map(f => `<div class="folder-chip ${folderId === f.id ? 'active' : ''}" data-folder="${f.id}">${f.icon || '📁'} ${escapeHtml(f.name)} <span style="font-size:11px;opacity:.5;cursor:pointer" onclick="event.stopPropagation();openEditFolderSheet('${f.id}')">✏️</span></div>`).join('') +
    `<div class="folder-chip" style="background:var(--lavender-bg);color:var(--lavender)" onclick="openNewFolderSheet()">＋ 新建</div>`;
  $('#noteFolders').innerHTML = folderHtml;

  $$('#noteFolders .folder-chip[data-folder]').forEach(c => {
    c.addEventListener('click', () => {
      state.currentNoteFolder = c.dataset.folder || null;
      initNotePage();
    });
  });

  let filtered = notes.sort((a,b) => b.createdAt - a.createdAt);
  if (folderId) filtered = filtered.filter(n => n.folderId === folderId);

  $('#noteCount').textContent = `${filtered.length} 条`;

  const html = filtered.length === 0
    ? '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">还没有笔记<br>点右上角新建吧</div></div>'
    : filtered.map(n => {
      const typeLabel = n.type === 'short' ? '💡 短记录' : '📝 长文';
      const folder = folders.find(f => f.id === n.folderId);
      return `<div class="note-card ${n.type}" onclick="go('noteEdit',{id:'${n.id}'})">
        <div class="note-type">${typeLabel}${folder ? ' · ' + (folder.icon || '📁') + ' ' + escapeHtml(folder.name) : ''}</div>
        ${n.title ? `<div class="note-title">${escapeHtml(n.title)}</div>` : ''}
        <div class="note-preview">${escapeHtml(n.content || '')}</div>
        <div class="note-footer">
          <span class="note-date">${timeAgo(n.createdAt)}</span>
          ${(n.tags || []).map(tg => `<span class="tag tag-lavender">${escapeHtml(tg)}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
  $('#noteList').innerHTML = html;
}

// ===== 笔记编辑 =====
function renderNoteEdit(id) {
  const isNew = !id;
  return `
    <div class="page active" id="page-noteEdit">
      <div class="editor-bar">
        <button class="menu-btn" onclick="go('note')">←</button>
        <input class="editor-title-input" id="noteTitleInput" placeholder="标题（可选）">
        <button class="top-action" onclick="saveNote('${id || ''}')">✓</button>
      </div>
      <div class="editor-body">
        <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
          <select id="noteFolderSelect" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(195,177,225,.2);background:#fff;font-size:13px;color:var(--text-primary);outline:none;">
            <option value="">📂 默认</option>
          </select>
          <select id="noteTypeSelect" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(195,177,225,.2);background:#fff;font-size:13px;color:var(--text-primary);outline:none;">
            <option value="short">💡 短记录</option>
            <option value="long">📝 长文</option>
          </select>
        </div>
        <div style="margin-bottom:12px">
          <label class="form-label">标签</label>
          <div class="tag-input-area" id="noteTagInput">
            <input placeholder="输入标签后回车…">
          </div>
        </div>
        <textarea class="editor-content-input" id="noteContentInput" placeholder="写下你的灵感…"></textarea>
        ${id ? `<div style="margin-top:16px"><button class="btn-danger" onclick="deleteNote('${id}')">🗑️ 删除此笔记</button></div>` : ''}
      </div>
    </div>
  `;
}

async function deleteNote(id) {
  if (!confirm('确定删除这条笔记吗？删除后无法恢复。')) return;
  await DB.delete('notes', id);
  showToast('已删除');
  go('note');
}

async function initNoteEditPage() {
  const id = state.pageParams?.id;
  const folders = await DB.getAll('folders');
  const folderSelect = $('#noteFolderSelect');
  folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = (f.icon || '📁') + ' ' + f.name;
    folderSelect.appendChild(opt);
  });

  let note = { type: 'short', tags: [], folderId: '', title: '', content: '' };
  if (id) {
    note = await DB.get('notes', id);
    if (!note) { go('note'); return; }
  }

  $('#noteTitleInput').value = note.title || '';
  $('#noteContentInput').value = note.content || '';
  $('#noteTypeSelect').value = note.type || 'short';
  if (note.folderId) $('#noteFolderSelect').value = note.folderId;

  // 标签输入
  const tagArea = $('#noteTagInput');
  const tagInput = tagArea.querySelector('input');
  let tags = [...(note.tags || [])];
  function renderTags() {
    tagArea.querySelectorAll('.tag-pill').forEach(p => p.remove());
    tags.forEach((t, i) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${escapeHtml(t)} <span class="remove">×</span>`;
      pill.querySelector('.remove').addEventListener('click', () => { tags.splice(i, 1); renderTags(); });
      tagArea.insertBefore(pill, tagInput);
    });
  }
  renderTags();
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && tagInput.value.trim()) {
      e.preventDefault();
      tags.push(tagInput.value.trim());
      tagInput.value = '';
      renderTags();
    }
  });

  state.editingNote = { id, tags };
}

async function saveNote(id) {
  const title = $('#noteTitleInput').value.trim();
  const content = $('#noteContentInput').value.trim();
  const type = $('#noteTypeSelect').value;
  const folderId = $('#noteFolderSelect').value || null;
  const tags = state.editingNote?.tags || [];

  if (!content) { showToast('内容不能为空'); return; }

  if (id) {
    const note = await DB.get('notes', id);
    note.title = title;
    note.content = content;
    note.type = type;
    note.folderId = folderId;
    note.tags = tags;
    await DB.put('notes', note);
    showToast('已保存');
  } else {
    await DB.add('notes', { title, content, type, folderId, tags });
    showToast('已创建');
  }
  go('note');
}

// ===== 阅读记录 =====
function renderReading() {
  return `
    <div class="page active" id="page-reading">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">阅读记录</div>
        <button class="top-action" onclick="openAddBookSheet()">＋</button>
      </div>
      <div class="section-title" style="margin-top:12px">本周阅读</div>
      <div class="reading-stats" id="readingStats"></div>
      <div class="section-title">书架 <span class="more" id="bookCount"></span></div>
      <div class="h-scroll" id="readingCategories"></div>
      <div class="book-shelf" id="bookShelf"></div>
      <div class="section-title">最近摘抄</div>
      <div class="note-list" id="excerptList"></div>
    </div>
  `;
}

async function initReadingPage() {
  const books = await DB.getAll('books');
  const excerpts = await DB.getAll('excerpts');
  const now = Date.now();
  const thisWeek = getWeekRange(now);
  const lastWeek = { start: thisWeek.start - 86400000 * 7, end: thisWeek.start - 1 };
  const thisWeekExcerpts = excerpts.filter(e => e.createdAt >= thisWeek.start && e.createdAt <= thisWeek.end);
  const lastWeekExcerpts = excerpts.filter(e => e.createdAt >= lastWeek.start && e.createdAt <= lastWeek.end);

  const trendText = lastWeekExcerpts.length === 0
    ? '本周开始记录'
    : thisWeekExcerpts.length >= lastWeekExcerpts.length
      ? `↑ 比上周多 ${thisWeekExcerpts.length - lastWeekExcerpts.length} 条`
      : `↓ 比上周少 ${lastWeekExcerpts.length - thisWeekExcerpts.length} 条`;

  $('#readingStats').innerHTML = `
    <div class="reading-stat-main">
      <div class="reading-stat-label">本周摘抄</div>
      <div><span class="reading-stat-num">${thisWeekExcerpts.length}</span><span class="reading-stat-unit">条</span></div>
      <div class="reading-stat-trend">${trendText}</div>
    </div>
    <div class="reading-stat-compare">
      <div class="label">上周</div>
      <div class="num">${lastWeekExcerpts.length}</div>
      <div class="label" style="margin-top:2px">条</div>
    </div>
  `;

  // 分类
  const categories = new Set(books.map(b => b.category).filter(Boolean));
  const catList = ['全部', ...Array.from(categories)];
  $('#readingCategories').innerHTML = catList.map(c =>
    `<div class="folder-chip ${c === state.currentBookFilter ? 'active' : ''}" data-cat="${escapeHtml(c)}">📚 ${escapeHtml(c)}</div>`
  ).join('') + `<div class="folder-chip" style="background:var(--lavender-bg);color:var(--lavender)" onclick="openAddCategorySheet()">＋ 新建</div>`;
  $$('#readingCategories .folder-chip[data-cat]').forEach(c => {
    c.addEventListener('click', () => {
      state.currentBookFilter = c.dataset.cat;
      initReadingPage();
    });
  });

  // 书架
  let filteredBooks = books.sort((a,b) => b.createdAt - a.createdAt);
  if (state.currentBookFilter !== '全部') {
    filteredBooks = filteredBooks.filter(b => b.category === state.currentBookFilter);
  }
  $('#bookCount').textContent = `${filteredBooks.length} 本`;

  const coverColors = ['b1','b2','b3','b4','b5','b6'];
  const coverBgs = [
    'linear-gradient(135deg,var(--peach),#D4847A)',
    'linear-gradient(135deg,var(--mist-blue),#6B9BB5)',
    'linear-gradient(135deg,var(--lavender),#9B7FC5)',
    'linear-gradient(135deg,#A8D5BA,#7BBF8A)',
    'linear-gradient(135deg,#F0C2A8,#D4847A)',
    'linear-gradient(135deg,#B8C5D6,#6B9BB5)'
  ];
  const statusMap = { reading: ['在读','status-reading'], done: ['已读','status-done'], want: ['想读','status-want'] };

  const bookHtml = filteredBooks.length === 0
    ? '<div style="grid-column:span 3" class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-text">还没有书籍<br>点右上角添加</div></div>'
    : filteredBooks.map((b, i) => {
      const st = statusMap[b.status] || statusMap.want;
      return `<div class="book-card" onclick="go('bookDetail',{id:'${b.id}'})">
        <div class="book-cover ${coverColors[i % 6]}" style="background:${coverBgs[i % 6]}">${b.cover || '📕'}</div>
        <div class="book-info">
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="book-author">${escapeHtml(b.author || '')}</div>
          <span class="book-status ${st[1]}">${st[0]}</span>
        </div>
      </div>`;
    }).join('');
  $('#bookShelf').innerHTML = bookHtml;

  // 摘抄
  const sortedExcerpts = excerpts.sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
  const excerptHtml = sortedExcerpts.length === 0
    ? '<div class="empty-state"><div class="empty-state-icon">✍️</div><div class="empty-state-text">还没有摘抄<br>进入书籍详情添加</div></div>'
    : sortedExcerpts.map(e => {
      const book = books.find(b => b.id === e.bookId);
      const cat = book ? book.category : '';
      const tagClass = cat === '文学' ? 'tag-lavender' : cat === '成长' ? 'tag-blue' : 'tag-peach';
      return `<div class="note-card" style="border-left:3px solid var(--lavender)" onclick="${book ? `go('bookDetail',{id:'${book.id}'})` : ''}">
        <div class="note-type">📖 《${escapeHtml(book ? book.title : '未知')}》${e.page ? ' · ' + escapeHtml(e.page) : ''}</div>
        <div class="note-preview">"${escapeHtml(e.content)}"</div>
        <div class="note-footer">
          <span class="note-date">${timeAgo(e.createdAt)}</span>
          ${cat ? `<span class="tag ${tagClass}">${escapeHtml(cat)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  $('#excerptList').innerHTML = excerptHtml;
}

// ===== 书籍详情 =====
function renderBookDetail(id) {
  return `
    <div class="page active" id="page-bookDetail">
      <div class="top-bar">
        <button class="menu-btn" onclick="go('reading')">←</button>
        <div class="top-title">书籍详情</div>
        <button class="top-action" onclick="openEditBookSheet('${id}')">✏️</button>
      </div>
      <div id="bookDetailContent"></div>
    </div>
  `;
}

async function renderBookDetailContent(id) {
  const book = await DB.get('books', id);
  if (!book) { go('reading'); return; }
  const excerpts = (await DB.getByIndex('excerpts', 'bookId', id)).sort((a,b) => b.createdAt - a.createdAt);
  const statusMap = { reading: ['在读','status-reading'], done: ['已读','status-done'], want: ['想读','status-want'] };
  const st = statusMap[book.status] || statusMap.want;

  let html = `<div style="padding:20px 16px;text-align:center;background:linear-gradient(135deg,var(--lavender-bg),var(--mist-blue-bg))">
    <div style="width:100px;height:133px;margin:0 auto 12px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;box-shadow:var(--shadow-soft);background:#fff">${book.cover || '📕'}</div>
    <div style="font-size:20px;font-weight:800">${escapeHtml(book.title)}</div>
    <div style="font-size:14px;color:var(--text-secondary);margin-top:4px">${escapeHtml(book.author || '')}</div>
    <div style="margin-top:8px"><span class="tag tag-peach">${escapeHtml(book.category || '未分类')}</span> <span class="book-status ${st[1]}">${st[0]}</span></div>
  </div>`;

  html += `<div class="section-title">摘抄 <span class="more">${excerpts.length} 条</span></div>`;
  html += `<div class="note-list">`;
  if (excerpts.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">✍️</div><div class="empty-state-text">还没有摘抄<br>点击下方按钮添加</div></div>';
  } else {
    html += excerpts.map(e => `<div class="note-card" style="border-left:3px solid var(--lavender)">
      <div class="note-type">${e.page ? escapeHtml(e.page) : '摘抄'} · ${timeAgo(e.createdAt)}</div>
      <div class="note-preview">"${escapeHtml(e.content)}"</div>
      <div style="margin-top:8px;display:flex;gap:12px">
        <span style="font-size:12px;color:var(--lavender);cursor:pointer" onclick="openEditExcerptSheet('${e.id}','${id}')">✏️ 编辑</span>
        <span style="font-size:12px;color:#E07070;cursor:pointer" onclick="deleteExcerpt('${e.id}','${id}')">🗑️ 删除</span>
      </div>
    </div>`).join('');
  }
  html += `</div>`;
  html += `<div style="padding:0 16px"><button class="btn-primary" onclick="openAddExcerptSheet('${id}')">＋ 添加摘抄</button></div>`;
  html += `<div style="padding:8px 16px"><button class="btn-danger" onclick="deleteBook('${id}')">🗑️ 删除此书</button></div>`;

  $('#bookDetailContent').innerHTML = html;
}

async function deleteBook(id) {
  if (!confirm('确定删除这本书及其所有摘抄吗？')) return;
  const excerpts = await DB.getByIndex('excerpts', 'bookId', id);
  for (const e of excerpts) await DB.delete('excerpts', e.id);
  await DB.delete('books', id);
  showToast('已删除');
  go('reading');
}

// ===== 待办 =====
function renderTodo() {
  return `
    <div class="page active" id="page-todo">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">待办事项</div>
        <button class="top-action" onclick="openAddTodoSheet()">＋</button>
      </div>
      <div style="padding:16px" id="todoList"></div>
    </div>
  `;
}

async function initTodoPage() {
  const todos = await DB.getAll('todos');
  const today = todayStr();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todayTodos = todos.filter(t => t.date === today).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const tomorrowTodos = todos.filter(t => t.date === tomorrow).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const otherTodos = todos.filter(t => t.date !== today && t.date !== tomorrow).sort((a,b) => (a.time||'').localeCompare(b.time||''));

  let html = '';
  if (todayTodos.length > 0) {
    html += `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;font-weight:500">今天 · ${today.slice(5).replace('-','月')}日</div>`;
    html += todayTodos.map(t => renderTodoItem(t)).join('');
  }
  if (tomorrowTodos.length > 0) {
    html += `<div style="font-size:13px;color:var(--text-secondary);margin:24px 0 12px;font-weight:500">明天 · ${tomorrow.slice(5).replace('-','月')}日</div>`;
    html += tomorrowTodos.map(t => renderTodoItem(t)).join('');
  }
  if (otherTodos.length > 0) {
    html += `<div style="font-size:13px;color:var(--text-secondary);margin:24px 0 12px;font-weight:500">更多</div>`;
    html += otherTodos.map(t => renderTodoItem(t)).join('');
  }
  if (html === '') {
    html = '<div class="empty-state"><div class="empty-state-icon">☑️</div><div class="empty-state-text">还没有待办<br>点右上角添加</div></div>';
  }
  $('#todoList').innerHTML = html;

  // 绑定勾选
  $$('.todo-check').forEach(c => {
    c.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = c.dataset.id;
      const todo = await DB.get('todos', id);
      todo.done = !todo.done;
      todo.doneAt = todo.done ? Date.now() : null;
      await DB.put('todos', todo);
      initTodoPage();
    });
  });
}

function renderTodoItem(t) {
  return `<div class="todo-item ${t.done ? 'done' : ''}">
    <div class="todo-check ${t.done ? 'done' : ''}" data-id="${t.id}">${t.done ? '✓' : ''}</div>
    <div class="todo-text" onclick="openEditTodoSheet('${t.id}')">${escapeHtml(t.text)}</div>
    <div class="todo-time">${escapeHtml(t.time || '')}</div>
    <span style="font-size:18px;color:var(--text-light);cursor:pointer;padding:0 4px;" onclick="event.stopPropagation();deleteTodo('${t.id}')">×</span>
  </div>`;
}

async function deleteTodo(id) {
  if (!confirm('确定删除这条待办吗？')) return;
  await DB.delete('todos', id);
  showToast('已删除');
  initTodoPage();
}

function openEditTodoSheet(id) {
  DB.get('todos', id).then(t => {
    if (!t) return;
    const html = `
      <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">编辑待办</div>
          <div class="form-group">
            <label class="form-label">内容</label>
            <input class="form-input" id="todoTextInput" value="${escapeHtml(t.text)}">
          </div>
          <div class="form-group">
            <label class="form-label">日期</label>
            <input class="form-input" id="todoDateInput" type="date" value="${t.date || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">时间（可选）</label>
            <input class="form-input" id="todoTimeInput" type="time" value="${t.time || ''}">
          </div>
          <button class="btn-primary" onclick="saveEditTodo('${id}')">保存修改</button>
          <button class="btn-secondary" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    modalContainer.innerHTML = html;
  });
}

async function saveEditTodo(id) {
  const text = $('#todoTextInput').value.trim();
  if (!text) { showToast('请填写内容'); return; }
  const t = await DB.get('todos', id);
  t.text = text;
  t.date = $('#todoDateInput').value;
  t.time = $('#todoTimeInput').value;
  await DB.put('todos', t);
  showToast('已保存');
  closeModal();
  initTodoPage();
}

// ===== 日程 =====
function renderSchedule() {
  return `
    <div class="page active" id="page-schedule">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">日程安排</div>
        <button class="top-action" onclick="openAddScheduleSheet()">＋</button>
      </div>
      <div style="padding:16px 0" id="scheduleList"></div>
    </div>
  `;
}

async function initSchedulePage() {
  const schedules = await DB.getAll('schedules');
  const today = todayStr();
  const todaySchedules = schedules.filter(s => s.date === today).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const otherSchedules = schedules.filter(s => s.date !== today).sort((a,b) => (a.date||'').localeCompare(b.date||''));

  let html = `<div style="text-align:center;padding:0 16px 16px"><div style="font-size:14px;color:var(--text-secondary)">今天 · ${today.slice(5).replace('-','月')}日</div></div>`;
  if (todaySchedules.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">今天没有日程</div></div>';
  } else {
    html += todaySchedules.map(s => renderScheduleItem(s)).join('');
  }
  if (otherSchedules.length > 0) {
    html += `<div class="section-title">更多日程</div>`;
    html += otherSchedules.map(s => renderScheduleItem(s)).join('');
  }
  $('#scheduleList').innerHTML = html;
}

function renderScheduleItem(s) {
  const colorClass = s.color || 'peach';
  return `<div class="schedule-item">
    <div class="schedule-time">${escapeHtml(s.time || '')}</div>
    <div class="schedule-card ${colorClass}" onclick="openEditScheduleSheet('${s.id}')" style="cursor:pointer">
      <div class="schedule-title">${escapeHtml(s.title)}</div>
      ${s.desc ? `<div class="schedule-desc">${escapeHtml(s.desc)}</div>` : ''}
      <div style="margin-top:6px;display:flex;gap:8px">
        <span style="font-size:11px;color:var(--text-light);cursor:pointer" onclick="event.stopPropagation();editSchedule('${s.id}')">✏️ 编辑</span>
        <span style="font-size:11px;color:#E07070;cursor:pointer" onclick="event.stopPropagation();deleteSchedule('${s.id}')">🗑️ 删除</span>
      </div>
    </div>
  </div>`;
}

async function deleteSchedule(id) {
  if (!confirm('确定删除这条日程吗？')) return;
  await DB.delete('schedules', id);
  showToast('已删除');
  initSchedulePage();
}

function editSchedule(id) {
  openEditScheduleSheet(id);
}

function openEditScheduleSheet(id) {
  DB.get('schedules', id).then(s => {
    if (!s) return;
    const html = `
      <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">编辑日程</div>
          <div class="form-group">
            <label class="form-label">标题</label>
            <input class="form-input" id="schedTitleInput" value="${escapeHtml(s.title)}">
          </div>
          <div class="form-group">
            <label class="form-label">备注（可选）</label>
            <input class="form-input" id="schedDescInput" value="${escapeHtml(s.desc || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">日期</label>
            <input class="form-input" id="schedDateInput" type="date" value="${s.date || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">时间</label>
            <input class="form-input" id="schedTimeInput" type="time" value="${s.time || '09:00'}">
          </div>
          <div class="form-group">
            <label class="form-label">颜色</label>
            <div style="display:flex;gap:8px">
              <span class="filter-chip ${s.color==='peach'?'active':''}" data-color="peach" onclick="selectSchedColor(this)">蜜桃</span>
              <span class="filter-chip ${s.color==='blue'?'active':''}" data-color="blue" onclick="selectSchedColor(this)">雾蓝</span>
              <span class="filter-chip ${s.color==='lavender'?'active':''}" data-color="lavender" onclick="selectSchedColor(this)">灰紫</span>
            </div>
          </div>
          <button class="btn-primary" onclick="saveEditSchedule('${id}')">保存修改</button>
          <button class="btn-danger" onclick="closeModal();deleteSchedule('${id}')">🗑️ 删除</button>
          <button class="btn-secondary" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    modalContainer.innerHTML = html;
    state._schedColor = s.color || 'peach';
  });
}

async function saveEditSchedule(id) {
  const title = $('#schedTitleInput').value.trim();
  if (!title) { showToast('请填写标题'); return; }
  const s = await DB.get('schedules', id);
  s.title = title;
  s.desc = $('#schedDescInput').value.trim();
  s.date = $('#schedDateInput').value;
  s.time = $('#schedTimeInput').value;
  s.color = state._schedColor || 'peach';
  await DB.put('schedules', s);
  showToast('已保存');
  closeModal();
  initSchedulePage();
}

// ===== 设置 =====
function renderSettings() {
  return `
    <div class="page active" id="page-settings">
      <div class="top-bar">
        <button class="menu-btn" onclick="openDrawer()"><span></span><span></span><span></span></button>
        <div class="top-title">设置</div>
      </div>
      <div style="padding:16px">
        <div class="card" style="margin-bottom:12px">
          <div style="font-size:16px;font-weight:700;margin-bottom:4px">💾 数据备份</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">导出你的所有数据（素材、笔记、书籍、待办、日程）为JSON文件，保存到网盘或发送给自己。</div>
          <button class="btn-primary" onclick="exportBackup()">导出备份</button>
        </div>
        <div class="card" style="margin-bottom:12px">
          <div style="font-size:16px;font-weight:700;margin-bottom:4px">📥 数据恢复</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">从备份文件恢复数据。注意：恢复会覆盖当前所有数据。</div>
          <button class="btn-primary" onclick="document.getElementById('importFile').click()">选择备份文件</button>
          <input type="file" id="importFile" accept=".json" style="display:none">
        </div>
        <div class="card" style="margin-bottom:12px">
          <div style="font-size:16px;font-weight:700;margin-bottom:4px">📊 数据统计</div>
          <div id="dataStats" style="font-size:14px;color:var(--text-secondary);line-height:2"></div>
        </div>
        <div class="card" style="margin-bottom:12px">
          <div style="font-size:16px;font-weight:700;margin-bottom:4px">ℹ️ 关于</div>
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">
            灵感工作台 v1.0<br>
            纯本地应用，数据不上传云端。<br>
            添加到主屏幕后可像App一样使用。
          </div>
        </div>
        <div class="card">
          <div style="font-size:16px;font-weight:700;margin-bottom:4px;color:#E07070">⚠️ 危险操作</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">清空所有数据，不可恢复。</div>
          <button class="btn-danger" onclick="clearAllData()">清空所有数据</button>
        </div>
      </div>
    </div>
  `;
}

async function initSettingsPage() {
  const stats = $('#dataStats');
  if (!stats) return;
  const stores = ['materials','collections','notes','folders','books','excerpts','todos','schedules'];
  const names = { materials:'素材', collections:'合集', notes:'笔记', folders:'文件夹', books:'书籍', excerpts:'摘抄', todos:'待办', schedules:'日程' };
  let html = '';
  for (const s of stores) {
    const count = (await DB.getAll(s)).length;
    html += `${names[s]}：${count} 条<br>`;
  }
  stats.innerHTML = html;

  const importFile = $('#importFile');
  if (importFile) {
    importFile.addEventListener('change', importBackup);
  }
}

async function exportBackup() {
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `灵感工作台备份_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('备份已导出');
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('导入会覆盖当前所有数据，确定继续吗？')) return;
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    await DB.importAll(backup);
    // 导入数据后，标记已初始化，永不再注入示例数据
    localStorage.setItem('dataCleared', '1');
    showToast('导入成功');
    go('home');
  } catch (err) {
    showToast('导入失败：文件格式错误');
  }
}

async function clearAllData() {
  if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
  if (!confirm('再次确认：所有素材、笔记、书籍、待办都将被删除！')) return;
  for (const s of Object.keys(DB.STORES)) {
    await DB.clear(s);
  }
  // 标记已清空，永不再注入示例数据
  localStorage.setItem('dataCleared', '1');
  showToast('已清空所有数据');
  go('home');
}

// ===== 弹层 =====
const modalContainer = $('#modalContainer');

function closeModal() {
  modalContainer.innerHTML = '';
}

// 添加素材弹层
function openMaterialAddSheet() {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">添加素材</div>
        <div class="save-source-grid">
          <div class="source-option" onclick="openMaterialForm('link')"><div class="source-icon">🔗</div><div class="source-label">粘贴链接</div></div>
          <div class="source-option" onclick="openMaterialForm('image')"><div class="source-icon">📷</div><div class="source-label">本地相册</div></div>
          <div class="source-option" onclick="openMaterialForm('file')"><div class="source-icon">📁</div><div class="source-label">文件上传</div></div>
          <div class="source-option" onclick="openMaterialForm('text')"><div class="source-icon">✏️</div><div class="source-label">文字备注</div></div>
        </div>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

function openMaterialForm(type, existing = null) {
  const typeLabels = { link: '链接', image: '图片', video: '视频', bgm: 'BGM', text: '文字' };
  const isBgm = type === 'bgm' || (existing && existing.type === 'bgm');
  const isEdit = !!existing;

  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">${isEdit ? '编辑素材' : '添加' + (typeLabels[type] || '素材')}</div>

        <div class="form-group">
          <label class="form-label">类型</label>
          <select id="matTypeSelect" class="form-input" ${isEdit ? 'disabled' : ''}>
            <option value="image" ${type==='image'?'selected':''}>📷 图片</option>
            <option value="video" ${type==='video'||type==='file'?'selected':''}>🎬 视频</option>
            <option value="bgm" ${type==='bgm'?'selected':''}>🎵 BGM</option>
            <option value="link" ${type==='link'?'selected':''}>🔗 链接</option>
            <option value="text" ${type==='text'?'selected':''}>✏️ 文字</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">标题</label>
          <input class="form-input" id="matTitleInput" placeholder="给素材起个名字…" value="${existing ? escapeHtml(existing.title || '') : ''}">
        </div>

        ${type === 'link' || isEdit ? `
        <div class="form-group">
          <label class="form-label">链接地址</label>
          <input class="form-input" id="matUrlInput" placeholder="粘贴小红书/抖音/网易云等链接…" value="${existing ? escapeHtml(existing.sourceUrl || '') : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">来源平台</label>
          <input class="form-input" id="matPlatformInput" placeholder="小红书 / 抖音 / 网易云…" value="${existing ? escapeHtml(existing.sourcePlatform || '') : ''}">
        </div>` : ''}

        ${type === 'text' || (isEdit && existing.type === 'text') ? `
        <div class="form-group">
          <label class="form-label">文字内容</label>
          <textarea class="form-textarea" id="matContentInput" placeholder="记录你想保存的文字…">${existing ? escapeHtml(existing.content || '') : ''}</textarea>
        </div>` : ''}

        <div class="form-group">
          <label class="form-label">标签</label>
          <div class="tag-input-area" id="matTagInput">
            <input placeholder="输入标签后回车…">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="matNoteInput" placeholder="写点什么，方便以后查找…">${existing ? escapeHtml(existing.note || '') : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">归入合集（可选）</label>
          <div id="matCollectionSelect" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        </div>

        <button class="btn-primary" onclick="saveMaterial('${existing ? existing.id : ''}')">${isEdit ? '保存修改' : '添加到素材库'}</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;

  // 标签输入
  initTagInput('matTagInput', existing ? existing.tags : []);

  // 加载合集
  DB.getAll('collections').then(collections => {
    const sel = $('#matCollectionSelect');
    let selectedCol = existing ? existing.collectionId : null;
    function renderCols() {
      sel.innerHTML = `<span class="filter-chip ${!selectedCol ? 'active' : ''}" data-col="">不归入</span>` +
        collections.map(c => `<span class="filter-chip ${selectedCol === c.id ? 'active' : ''}" data-col="${c.id}">${c.icon || '📁'} ${escapeHtml(c.name)}</span>`).join('');
      sel.querySelectorAll('.filter-chip').forEach(ch => {
        ch.addEventListener('click', () => {
          selectedCol = ch.dataset.col || null;
          renderCols();
        });
      });
    }
    renderCols();
    state._selectedCollection = () => selectedCol;
  });
}

function initTagInput(containerId, initialTags = []) {
  const area = $('#' + containerId);
  if (!area) return;
  const input = area.querySelector('input');
  let tags = [...initialTags];
  function render() {
    area.querySelectorAll('.tag-pill').forEach(p => p.remove());
    tags.forEach((t, i) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${escapeHtml(t)} <span class="remove">×</span>`;
      pill.querySelector('.remove').addEventListener('click', () => { tags.splice(i, 1); render(); });
      area.insertBefore(pill, input);
    });
  }
  render();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      tags.push(input.value.trim());
      input.value = '';
      render();
    }
  });
  state['_tags_' + containerId] = () => tags;
}

async function saveMaterial(id) {
  const type = $('#matTypeSelect').value;
  const title = $('#matTitleInput').value.trim();
  const sourceUrl = $('#matUrlInput') ? $('#matUrlInput').value.trim() : '';
  const sourcePlatform = $('#matPlatformInput') ? $('#matPlatformInput').value.trim() : '';
  const content = $('#matContentInput') ? $('#matContentInput').value.trim() : '';
  const note = $('#matNoteInput').value.trim();
  const tags = state['_tags_matTagInput'] ? state['_tags_matTagInput']() : [];
  const collectionId = state._selectedCollection ? state._selectedCollection() : null;

  if (!title) { showToast('请填写标题'); return; }

  const data = { type, title, sourceUrl, sourcePlatform, content, note, tags, collectionId };
  if (id) {
    data.id = id;
    const old = await DB.get('materials', id);
    data.createdAt = old.createdAt;
    await DB.put('materials', data);
    showToast('已保存');
  } else {
    await DB.add('materials', data);
    showToast('已添加');
  }
  closeModal();
  if (state.currentPage === 'material') initMaterialPage();
  if (state.currentPage === 'materialDetail') renderMaterialDetailContent(id);
  if (state.currentPage === 'home') initHomePage();
}

function openMaterialEditSheet(id) {
  DB.get('materials', id).then(m => {
    if (m) openMaterialForm(m.type, m);
  });
}

// 新建合集
function openNewCollectionSheet() {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">新建合集</div>
        <div class="form-group">
          <label class="form-label">合集名称</label>
          <input class="form-input" id="colNameInput" placeholder="比如：拍摄参考">
        </div>
        <div class="form-group">
          <label class="form-label">图标（emoji）</label>
          <input class="form-input" id="colIconInput" placeholder="📷" value="📁">
        </div>
        <button class="btn-primary" onclick="saveCollection()">创建</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

async function saveCollection() {
  const name = $('#colNameInput').value.trim();
  if (!name) { showToast('请填写名称'); return; }
  const icon = $('#colIconInput').value.trim() || '📁';
  await DB.add('collections', { name, icon });
  showToast('已创建');
  closeModal();
  if (state.currentPage === 'material') initMaterialPage();
}

function openEditCollectionSheet(id) {
  DB.get('collections', id).then(c => {
    if (!c) return;
    const html = `
      <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">编辑合集</div>
          <div class="form-group">
            <label class="form-label">合集名称</label>
            <input class="form-input" id="colNameInput" value="${escapeHtml(c.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">图标（emoji）</label>
            <input class="form-input" id="colIconInput" value="${escapeHtml(c.icon || '📁')}">
          </div>
          <button class="btn-primary" onclick="saveEditCollection('${id}')">保存修改</button>
          <button class="btn-danger" onclick="deleteCollection('${id}')">🗑️ 删除合集</button>
          <button class="btn-secondary" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    modalContainer.innerHTML = html;
  });
}

async function saveEditCollection(id) {
  const name = $('#colNameInput').value.trim();
  if (!name) { showToast('请填写名称'); return; }
  const c = await DB.get('collections', id);
  c.name = name;
  c.icon = $('#colIconInput').value.trim() || '📁';
  await DB.put('collections', c);
  showToast('已保存');
  closeModal();
  if (state.currentPage === 'material') initMaterialPage();
}

async function deleteCollection(id) {
  if (!confirm('确定删除这个合集吗？合集内的素材不会被删除，只是不再归类。')) return;
  // 把该合集下的素材的 collectionId 置空
  const materials = await DB.getAll('materials');
  for (const m of materials) {
    if (m.collectionId === id) {
      m.collectionId = null;
      await DB.put('materials', m);
    }
  }
  await DB.delete('collections', id);
  showToast('已删除');
  closeModal();
  if (state.currentPage === 'material') initMaterialPage();
}

// 笔记类型选择
function openNoteTypeSheet() {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">新建笔记</div>
        <div class="source-option" style="margin-bottom:12px" onclick="closeModal();go('noteEdit',{type:'short'})">
          <div style="display:flex;align-items:center;gap:14px;padding:8px">
            <div class="source-icon" style="margin:0">💡</div>
            <div><div class="source-label" style="text-align:left">短记录</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px">一句话灵感、闪念，像便签一样快</div></div>
          </div>
        </div>
        <div class="source-option" onclick="closeModal();go('noteEdit',{type:'long'})">
          <div style="display:flex;align-items:center;gap:14px;padding:8px">
            <div class="source-icon" style="margin:0">📝</div>
            <div><div class="source-label" style="text-align:left">长文笔记</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px">脚本草稿、复盘，支持标题、分段</div></div>
          </div>
        </div>
        <button class="btn-secondary" onclick="closeModal()" style="margin-top:16px">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

// 新建文件夹
function openNewFolderSheet() {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">新建文件夹</div>
        <div class="form-group">
          <label class="form-label">文件夹名称</label>
          <input class="form-input" id="folderNameInput" placeholder="比如：创意灵感">
        </div>
        <div class="form-group">
          <label class="form-label">图标（emoji）</label>
          <input class="form-input" id="folderIconInput" placeholder="💡" value="📁">
        </div>
        <button class="btn-primary" onclick="saveFolder()">创建</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

async function saveFolder() {
  const name = $('#folderNameInput').value.trim();
  if (!name) { showToast('请填写名称'); return; }
  const icon = $('#folderIconInput').value.trim() || '📁';
  await DB.add('folders', { name, icon });
  showToast('已创建');
  closeModal();
  if (state.currentPage === 'note') initNotePage();
}

function openEditFolderSheet(id) {
  DB.get('folders', id).then(f => {
    if (!f) return;
    const html = `
      <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">编辑文件夹</div>
          <div class="form-group">
            <label class="form-label">文件夹名称</label>
            <input class="form-input" id="folderNameInput" value="${escapeHtml(f.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">图标（emoji）</label>
            <input class="form-input" id="folderIconInput" value="${escapeHtml(f.icon || '📁')}">
          </div>
          <button class="btn-primary" onclick="saveEditFolder('${id}')">保存修改</button>
          <button class="btn-danger" onclick="deleteFolder('${id}')">🗑️ 删除文件夹</button>
          <button class="btn-secondary" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    modalContainer.innerHTML = html;
  });
}

async function saveEditFolder(id) {
  const name = $('#folderNameInput').value.trim();
  if (!name) { showToast('请填写名称'); return; }
  const f = await DB.get('folders', id);
  f.name = name;
  f.icon = $('#folderIconInput').value.trim() || '📁';
  await DB.put('folders', f);
  showToast('已保存');
  closeModal();
  if (state.currentPage === 'note') initNotePage();
}

async function deleteFolder(id) {
  if (!confirm('确定删除这个文件夹吗？文件夹内的笔记会保留，但会变成"未分类"。')) return;
  // 把该文件夹下的笔记的 folderId 置空
  const notes = await DB.getByIndex('notes', 'folderId', id);
  for (const n of notes) {
    n.folderId = null;
    await DB.put('notes', n);
  }
  await DB.delete('folders', id);
  showToast('已删除');
  closeModal();
  if (state.currentPage === 'note') initNotePage();
}

// 添加书籍
function openAddBookSheet() {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">添加书籍</div>
        <div class="form-group">
          <label class="form-label">书名</label>
          <input class="form-input" id="bookTitleInput" placeholder="输入书名">
        </div>
        <div class="form-group">
          <label class="form-label">作者</label>
          <input class="form-input" id="bookAuthorInput" placeholder="作者名">
        </div>
        <div class="form-group">
          <label class="form-label">封面图标（emoji）</label>
          <input class="form-input" id="bookCoverInput" placeholder="📕" value="📕">
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <input class="form-input" id="bookCategoryInput" placeholder="文学 / 成长 / 设计…">
        </div>
        <div class="form-group">
          <label class="form-label">阅读状态</label>
          <div style="display:flex;gap:8px">
            <span class="filter-chip" data-status="want" onclick="selectBookStatus(this)">想读</span>
            <span class="filter-chip active" data-status="reading" onclick="selectBookStatus(this)">在读</span>
            <span class="filter-chip" data-status="done" onclick="selectBookStatus(this)">已读</span>
          </div>
        </div>
        <button class="btn-primary" onclick="saveBook('')">添加到书架</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
  state._bookStatus = 'reading';
}

function selectBookStatus(ch) {
  ch.parentNode.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  ch.classList.add('active');
  state._bookStatus = ch.dataset.status;
}

async function saveBook(id) {
  const title = $('#bookTitleInput').value.trim();
  if (!title) { showToast('请填写书名'); return; }
  const author = $('#bookAuthorInput').value.trim();
  const cover = $('#bookCoverInput').value.trim() || '📕';
  const category = $('#bookCategoryInput').value.trim() || '未分类';
  const status = state._bookStatus || 'reading';

  if (id) {
    const book = await DB.get('books', id);
    book.title = title; book.author = author; book.cover = cover; book.category = category; book.status = status;
    await DB.put('books', book);
  } else {
    await DB.add('books', { title, author, cover, category, status });
  }
  showToast('已保存');
  closeModal();
  if (state.currentPage === 'reading') initReadingPage();
  if (state.currentPage === 'bookDetail') renderBookDetailContent(id);
}

function openEditBookSheet(id) {
  DB.get('books', id).then(book => {
    if (!book) return;
    const html = `
      <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">编辑书籍</div>
          <div class="form-group">
            <label class="form-label">书名</label>
            <input class="form-input" id="bookTitleInput" value="${escapeHtml(book.title || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">作者</label>
            <input class="form-input" id="bookAuthorInput" value="${escapeHtml(book.author || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">封面图标（emoji）</label>
            <input class="form-input" id="bookCoverInput" value="${escapeHtml(book.cover || '📕')}">
          </div>
          <div class="form-group">
            <label class="form-label">分类</label>
            <input class="form-input" id="bookCategoryInput" value="${escapeHtml(book.category || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">阅读状态</label>
            <div style="display:flex;gap:8px">
              <span class="filter-chip ${book.status==='want'?'active':''}" data-status="want" onclick="selectBookStatus(this)">想读</span>
              <span class="filter-chip ${book.status==='reading'?'active':''}" data-status="reading" onclick="selectBookStatus(this)">在读</span>
              <span class="filter-chip ${book.status==='done'?'active':''}" data-status="done" onclick="selectBookStatus(this)">已读</span>
            </div>
          </div>
          <button class="btn-primary" onclick="saveBook('${id}')">保存修改</button>
          <button class="btn-secondary" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    modalContainer.innerHTML = html;
    state._bookStatus = book.status;
  });
}

// 添加摘抄
function openAddExcerptSheet(bookId) {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">添加摘抄</div>
        <div class="form-group">
          <label class="form-label">摘抄内容</label>
          <textarea class="form-textarea" id="excerptContentInput" placeholder="写下让你印象深刻的句子…" style="min-height:120px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">页码/章节（可选）</label>
          <input class="form-input" id="excerptPageInput" placeholder="第3章 / 第45页">
        </div>
        <button class="btn-primary" onclick="saveExcerpt('${bookId}')">保存摘抄</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

async function saveExcerpt(bookId) {
  const content = $('#excerptContentInput').value.trim();
  if (!content) { showToast('请填写摘抄内容'); return; }
  const page = $('#excerptPageInput').value.trim();
  await DB.add('excerpts', { bookId, content, page });
  showToast('已保存');
  closeModal();
  renderBookDetailContent(bookId);
}

async function deleteExcerpt(id, bookId) {
  if (!confirm('确定删除这条摘抄吗？')) return;
  await DB.delete('excerpts', id);
  showToast('已删除');
  renderBookDetailContent(bookId);
}

function openEditExcerptSheet(id, bookId) {
  DB.get('excerpts', id).then(e => {
    if (!e) return;
    const html = `
      <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">编辑摘抄</div>
          <div class="form-group">
            <label class="form-label">摘抄内容</label>
            <textarea class="form-textarea" id="excerptContentInput" style="min-height:120px">${escapeHtml(e.content)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">页码/章节（可选）</label>
            <input class="form-input" id="excerptPageInput" value="${escapeHtml(e.page || '')}">
          </div>
          <button class="btn-primary" onclick="saveEditExcerpt('${id}','${bookId}')">保存修改</button>
          <button class="btn-danger" onclick="closeModal();deleteExcerpt('${id}','${bookId}')">🗑️ 删除</button>
          <button class="btn-secondary" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    modalContainer.innerHTML = html;
  });
}

async function saveEditExcerpt(id, bookId) {
  const content = $('#excerptContentInput').value.trim();
  if (!content) { showToast('请填写内容'); return; }
  const e = await DB.get('excerpts', id);
  e.content = content;
  e.page = $('#excerptPageInput').value.trim();
  await DB.put('excerpts', e);
  showToast('已保存');
  closeModal();
  renderBookDetailContent(bookId);
}

// 添加待办
function openAddTodoSheet() {
  const today = todayStr();
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">添加待办</div>
        <div class="form-group">
          <label class="form-label">内容</label>
          <input class="form-input" id="todoTextInput" placeholder="要做什么？">
        </div>
        <div class="form-group">
          <label class="form-label">日期</label>
          <input class="form-input" id="todoDateInput" type="date" value="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">时间（可选）</label>
          <input class="form-input" id="todoTimeInput" type="time">
        </div>
        <button class="btn-primary" onclick="saveTodo()">添加</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

async function saveTodo() {
  const text = $('#todoTextInput').value.trim();
  if (!text) { showToast('请填写内容'); return; }
  const date = $('#todoDateInput').value;
  const time = $('#todoTimeInput').value;
  await DB.add('todos', { text, date, time, done: false, doneAt: null });
  showToast('已添加');
  closeModal();
  if (state.currentPage === 'todo') initTodoPage();
}

// 添加日程
function openAddScheduleSheet() {
  const today = todayStr();
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">添加日程</div>
        <div class="form-group">
          <label class="form-label">标题</label>
          <input class="form-input" id="schedTitleInput" placeholder="日程标题">
        </div>
        <div class="form-group">
          <label class="form-label">备注（可选）</label>
          <input class="form-input" id="schedDescInput" placeholder="补充说明">
        </div>
        <div class="form-group">
          <label class="form-label">日期</label>
          <input class="form-input" id="schedDateInput" type="date" value="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">时间</label>
          <input class="form-input" id="schedTimeInput" type="time" value="09:00">
        </div>
        <div class="form-group">
          <label class="form-label">颜色</label>
          <div style="display:flex;gap:8px">
            <span class="filter-chip active" data-color="peach" onclick="selectSchedColor(this)">蜜桃</span>
            <span class="filter-chip" data-color="blue" onclick="selectSchedColor(this)">雾蓝</span>
            <span class="filter-chip" data-color="lavender" onclick="selectSchedColor(this)">灰紫</span>
          </div>
        </div>
        <button class="btn-primary" onclick="saveSchedule()">添加</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
  state._schedColor = 'peach';
}

function selectSchedColor(ch) {
  ch.parentNode.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  ch.classList.add('active');
  state._schedColor = ch.dataset.color;
}

async function saveSchedule() {
  const title = $('#schedTitleInput').value.trim();
  if (!title) { showToast('请填写标题'); return; }
  const desc = $('#schedDescInput').value.trim();
  const date = $('#schedDateInput').value;
  const time = $('#schedTimeInput').value;
  const color = state._schedColor || 'peach';
  await DB.add('schedules', { title, desc, date, time, color });
  showToast('已添加');
  closeModal();
  if (state.currentPage === 'schedule') initSchedulePage();
}

// 新建分类
function openAddCategorySheet() {
  const html = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">新建分类</div>
        <div class="form-group">
          <label class="form-label">分类名称</label>
          <input class="form-input" id="categoryNameInput" placeholder="比如：历史 / 哲学">
        </div>
        <button class="btn-primary" onclick="addCategory()">创建</button>
        <button class="btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>`;
  modalContainer.innerHTML = html;
}

async function addCategory() {
  const name = $('#categoryNameInput').value.trim();
  if (!name) { showToast('请填写名称'); return; }
  state.currentBookFilter = name;
  closeModal();
  showToast('分类已创建，添加书籍时选择该分类');
  initReadingPage();
}

// ===== 搜索功能 =====
function initSearchPage() {
  const input = $('#searchInput');
  if (!input) return;
  let timer;
  input.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(e.target.value), 300);
  });
}

async function doSearch(query) {
  const results = $('#searchResults');
  if (!query || !query.trim()) {
    results.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">输入关键词搜索你的素材库</div></div>';
    return;
  }
  const q = query.toLowerCase();
  const materials = await DB.getAll('materials');
  const notes = await DB.getAll('notes');
  const excerpts = await DB.getAll('excerpts');
  const books = await DB.getAll('books');

  const matResults = materials.filter(m =>
    (m.title || '').toLowerCase().includes(q) ||
    (m.note || '').toLowerCase().includes(q) ||
    (m.tags || []).some(t => t.toLowerCase().includes(q))
  );
  const noteResults = notes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.content || '').toLowerCase().includes(q) ||
    (n.tags || []).some(t => t.toLowerCase().includes(q))
  );
  const excerptResults = excerpts.filter(e => (e.content || '').toLowerCase().includes(q));
  const bookResults = books.filter(b =>
    (b.title || '').toLowerCase().includes(q) ||
    (b.author || '').toLowerCase().includes(q)
  );

  let html = '';
  if (matResults.length === 0 && noteResults.length === 0 && excerptResults.length === 0 && bookResults.length === 0) {
    html = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">没有找到相关内容</div></div>';
  } else {
    if (matResults.length > 0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">📦 素材 (${matResults.length})</div>`;
      html += matResults.map(m => renderInspCard(m)).join('');
    }
    if (noteResults.length > 0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:16px 0 8px">📝 笔记 (${noteResults.length})</div>`;
      html += noteResults.map(n => `<div class="note-card ${n.type}" onclick="go('noteEdit',{id:'${n.id}'})">
        <div class="note-type">${n.type === 'short' ? '💡 短记录' : '📝 长文'}</div>
        ${n.title ? `<div class="note-title">${escapeHtml(n.title)}</div>` : ''}
        <div class="note-preview">${escapeHtml(n.content || '')}</div>
      </div>`).join('');
    }
    if (bookResults.length > 0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:16px 0 8px">📚 书籍 (${bookResults.length})</div>`;
      html += bookResults.map(b => `<div class="note-card" style="border-left:3px solid var(--lavender)" onclick="go('bookDetail',{id:'${b.id}'})">
        <div class="note-type">📖 ${escapeHtml(b.category || '')}</div>
        <div class="note-title">${escapeHtml(b.title)}</div>
        <div class="note-preview">${escapeHtml(b.author || '')}</div>
      </div>`).join('');
    }
    if (excerptResults.length > 0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:16px 0 8px">✍️ 摘抄 (${excerptResults.length})</div>`;
      html += excerptResults.map(e => {
        const book = books.find(b => b.id === e.bookId);
        return `<div class="note-card" style="border-left:3px solid var(--mist-blue)" onclick="${book ? `go('bookDetail',{id:'${book.id}'})` : ''}">
          <div class="note-type">📖 《${escapeHtml(book ? book.title : '未知')}》</div>
          <div class="note-preview">"${escapeHtml(e.content)}"</div>
        </div>`;
      }).join('');
    }
  }
  results.innerHTML = html;
}

// 补充搜索页的初始化到路由
const _origRenderPage = renderPage;
renderPage = function() {
  _origRenderPage();
  if (state.currentPage === 'search') {
    setTimeout(() => {
      const input = $('#searchInput');
      if (input) {
        let timer;
        input.addEventListener('input', (e) => {
          clearTimeout(timer);
          timer = setTimeout(() => doSearch(e.target.value), 300);
        });
        doSearch('');
      }
    }, 0);
  }
  if (state.currentPage === 'materialDetail') {
    renderMaterialDetailContent(state.pageParams?.id);
  }
  if (state.currentPage === 'bookDetail') {
    renderBookDetailContent(state.pageParams?.id);
  }
  if (state.currentPage === 'schedule') {
    initSchedulePage();
  }
};

// ===== 初始化 =====
async function init() {
  // 打开数据库
  await openDB();
  // 注入示例数据（首次使用）
  const seeded = await DB.seedIfEmpty();

  // 事件绑定
  $$('.drawer-item').forEach(item => {
    item.addEventListener('click', () => go(item.dataset.page));
  });
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => go(item.dataset.page));
  });
  $('#drawerOverlay').addEventListener('click', closeDrawer);

  // 根据hash初始化页面
  const hash = location.hash.slice(1);
  if (hash && ['home','inspiration','material','note','reading','todo','schedule','settings'].includes(hash)) {
    go(hash);
  } else {
    renderPage();
  }
}

// PWA安装引导
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;
  // 首次访问不显示，之后显示
  if (!localStorage.getItem('installDismissed')) {
    setTimeout(() => $('#installBanner').classList.remove('hide'), 3000);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  $('#installBtn')?.addEventListener('click', async () => {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      const { outcome } = await state.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        $('#installBanner').classList.add('hide');
      }
      state.deferredInstallPrompt = null;
    } else {
      showToast('请使用浏览器的"添加到主屏幕"功能');
    }
  });
  $('#installClose')?.addEventListener('click', () => {
    $('#installBanner').classList.add('hide');
    localStorage.setItem('installDismissed', '1');
  });

  init();
});

// Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
