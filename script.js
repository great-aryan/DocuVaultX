/**
 * ═══════════════════════════════════════════════════════════════
 *  DocuVault – script.js
 *  Description: All application logic for the DocuVault dashboard.
 *               Modular, well-commented, and easy to extend.
 *  v1.1.0 – Added: GDrive download panel, table scroll fix
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ════════════════════════════════════════
   MODULE 1 – APP STATE
════════════════════════════════════════ */
const State = {
  allDocs:        [],
  filteredDocs:   [],
  currentPage:    'dashboard',
  sortKey:        'DocumentID',
  sortDir:        'asc',
  search:         '',
  filters: {
    Category:     '',
    Priority:     '',
    ExpiryStatus: '',
    Status:       ''
  },
  sensitive:      false,
  charts:         {},
  theme:          'light'
};

/* ════════════════════════════════════════
   MODULE 2 – CONSTANTS & CONFIG
════════════════════════════════════════ */
const CATEGORY_COLORS = {
  'Identity':  '#0d9488',
  'Financial': '#3b82f6',
  'Insurance': '#a855f7',
  'Property':  '#f59e0b',
  'Education': '#22c55e',
  'Vehicle':   '#ef4444',
  'Utility':   '#64748b',
};

const EXPIRY_SOON_DAYS = 90;

/**
 * GDrive key → human-readable label + icon mapping.
 * Grouped as PDF or JPG for the download panel.
 */
const GDRIVE_META = {
  pdfOG:     { label: 'PDF – Original',     icon: 'ph-file-pdf',   group: 'pdf', size: 'Original' },
  pdf2047kb: { label: 'PDF – ≤2 MB',        icon: 'ph-file-pdf',   group: 'pdf', size: '≤2 MB' },
  pdf1023kb: { label: 'PDF – ≤1 MB',        icon: 'ph-file-pdf',   group: 'pdf', size: '≤1 MB' },
  pdf499kb:  { label: 'PDF – ≤500 KB',      icon: 'ph-file-pdf',   group: 'pdf', size: '≤500 KB' },
  pdf99kb:   { label: 'PDF – ≤100 KB',      icon: 'ph-file-pdf',   group: 'pdf', size: '≤100 KB' },
  jpgOG:     { label: 'JPG – Original',     icon: 'ph-file-image', group: 'jpg', size: 'Original' },
  jpg2047kb: { label: 'JPG – ≤2 MB',        icon: 'ph-file-image', group: 'jpg', size: '≤2 MB' },
  jpg1023kb: { label: 'JPG – ≤1 MB',        icon: 'ph-file-image', group: 'jpg', size: '≤1 MB' },
  jpg499kb:  { label: 'JPG – ≤500 KB',      icon: 'ph-file-image', group: 'jpg', size: '≤500 KB' },
  jpg99kb:   { label: 'JPG – ≤100 KB',      icon: 'ph-file-image', group: 'jpg', size: '≤100 KB' },
  jpg19kb:   { label: 'JPG – ≤20 KB',       icon: 'ph-file-image', group: 'jpg', size: '≤20 KB' },
};

/* ════════════════════════════════════════
   MODULE 3 – DATA LOADING
════════════════════════════════════════ */
async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const raw = await response.json();

    State.allDocs = raw.map(doc => ({
      ...doc,
      ExpiryStatus: calcExpiryStatus(doc.ExpiryDate)
    }));

    State.filteredDocs = [...State.allDocs];
    initApp();
  } catch (err) {
    console.error('DocuVault: Failed to load data.json →', err);
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#ef4444;">
        <h2>⚠️ Could not load data.json</h2>
        <p style="color:#64748b;margin-top:8px;">Make sure you are running via a local server (not file://). See README.md.</p>
      </div>`;
  }
}

function calcExpiryStatus(dateStr) {
  if (!dateStr || dateStr.trim() === '') return 'No Expiry';
  const expiry = new Date(dateStr);
  const now    = new Date();
  const diffMs = expiry - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0)                return 'Expired';
  if (diffDays <= EXPIRY_SOON_DAYS) return 'Expiring Soon';
  return 'Valid';
}

/* ════════════════════════════════════════
   MODULE 4 – INITIALIZATION
════════════════════════════════════════ */
function initApp() {
  loadPreferences();
  populateFilterDropdowns();
  buildCategoryPills();
  renderDashboard();
  renderDocumentTable();
  renderAlerts();
  updateBadges();
}

function loadPreferences() {
  const saved = localStorage.getItem('docuvault_prefs');
  if (saved) {
    try {
      const prefs = JSON.parse(saved);
      if (prefs.theme) {
        State.theme = prefs.theme;
        document.documentElement.setAttribute('data-theme', prefs.theme);
        updateThemeUI();
      }
      if (prefs.sensitive !== undefined) {
        State.sensitive = prefs.sensitive;
        updateSensitiveUI();
      }
    } catch (e) { /* ignore corrupt prefs */ }
  }
}

function savePreferences() {
  localStorage.setItem('docuvault_prefs', JSON.stringify({
    theme:     State.theme,
    sensitive: State.sensitive
  }));
}

/* ════════════════════════════════════════
   MODULE 5 – NAVIGATION
════════════════════════════════════════ */
function navigate(page) {
  State.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });
  const titles = {
    dashboard: { h: 'Dashboard',  sub: 'Overview of your document vault' },
    documents: { h: 'Documents',  sub: 'Browse, search & filter all documents' },
    alerts:    { h: 'Alerts',     sub: 'Expiring and expired documents' }
  };
  const t = titles[page] || titles.dashboard;
  document.getElementById('pageTitle').querySelector('h1').textContent = t.h;
  document.getElementById('pageSub').textContent = t.sub;
  closeSidebar();
}

function filterAndGo(field, value) {
  const map = {
    Priority:     'filterPriority',
    ExpiryStatus: 'filterExpiry',
    Category:     'filterCategory',
    Status:       'filterStatus'
  };
  if (map[field]) {
    document.getElementById(map[field]).value = value;
    State.filters[field] = value;
  }
  navigate('documents');
  applyFilters();
}

/* ════════════════════════════════════════
   MODULE 6 – SIDEBAR TOGGLE
════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

/* ════════════════════════════════════════
   MODULE 7 – THEME TOGGLE
════════════════════════════════════════ */
function toggleTheme() {
  State.theme = State.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', State.theme);
  updateThemeUI();
  savePreferences();
  destroyCharts();
  renderCharts();
}

function updateThemeUI() {
  const isDark = State.theme === 'dark';
  document.getElementById('themeIcon').className  = isDark ? 'ph-duotone ph-sun' : 'ph-duotone ph-moon';
  document.getElementById('themeLabel').textContent = isDark ? 'Light Mode' : 'Dark Mode';
}

/* ════════════════════════════════════════
   MODULE 8 – SENSITIVE FIELDS TOGGLE
════════════════════════════════════════ */
function toggleSensitive() {
  State.sensitive = !State.sensitive;
  updateSensitiveUI();
  renderDocumentTable();
  savePreferences();
}

function updateSensitiveUI() {
  const btn  = document.getElementById('sensitiveToggle');
  const icon = document.getElementById('sensitiveIcon');
  if (State.sensitive) {
    btn.classList.add('active');
    icon.className = 'ph-duotone ph-eye-slash';
    btn.querySelector('.tooltip').textContent = 'Show Sensitive Fields';
  } else {
    btn.classList.remove('active');
    icon.className = 'ph-duotone ph-eye';
    btn.querySelector('.tooltip').textContent = 'Hide Sensitive Fields';
  }
}

/* ════════════════════════════════════════
   MODULE 9 – SEARCH
════════════════════════════════════════ */
function handleSearch() {
  State.search = document.getElementById('globalSearch').value.trim().toLowerCase();
  const clear = document.getElementById('searchClear');
  clear.classList.toggle('visible', State.search.length > 0);
  applyFilters();
}

function clearSearch() {
  document.getElementById('globalSearch').value = '';
  State.search = '';
  document.getElementById('searchClear').classList.remove('visible');
  applyFilters();
}

/* ════════════════════════════════════════
   MODULE 10 – FILTERS
════════════════════════════════════════ */
function applyFilters() {
  State.filters.Category     = document.getElementById('filterCategory').value;
  State.filters.Priority     = document.getElementById('filterPriority').value;
  State.filters.ExpiryStatus = document.getElementById('filterExpiry').value;
  State.filters.Status       = document.getElementById('filterStatus').value;

  State.filteredDocs = State.allDocs.filter(doc => {
    if (State.search) {
      const haystack = [doc.Name, doc.Category, doc.DocumentID, doc.Authority, doc.HolderName]
        .join(' ').toLowerCase();
      if (!haystack.includes(State.search)) return false;
    }
    if (State.filters.Category     && doc.Category     !== State.filters.Category)     return false;
    if (State.filters.Priority     && doc.Priority     !== State.filters.Priority)     return false;
    if (State.filters.ExpiryStatus && doc.ExpiryStatus !== State.filters.ExpiryStatus) return false;
    if (State.filters.Status       && doc.Status       !== State.filters.Status)       return false;
    return true;
  });

  renderDocumentTable();
}

function clearFilters() {
  ['filterCategory','filterPriority','filterExpiry','filterStatus'].forEach(id => {
    document.getElementById(id).value = '';
  });
  State.filters = { Category:'', Priority:'', ExpiryStatus:'', Status:'' };
  applyFilters();
}

function populateFilterDropdowns() {
  const categories = [...new Set(State.allDocs.map(d => d.Category))].sort();
  const sel = document.getElementById('filterCategory');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    sel.appendChild(opt);
  });
}

/* ════════════════════════════════════════
   MODULE 11 – SORTING
════════════════════════════════════════ */
function sortTable(key) {
  if (State.sortKey === key) {
    State.sortDir = State.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    State.sortKey = key;
    State.sortDir = 'asc';
  }

  document.querySelectorAll('.doc-table th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === key) {
      th.classList.add(State.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.className = `ph-bold ${State.sortDir === 'asc' ? 'ph-caret-up' : 'ph-caret-down'} sort-icon`;
    }
  });

  State.filteredDocs.sort((a, b) => {
    let va = a[key] || '';
    let vb = b[key] || '';
    if (key === 'DocumentID') { va = parseInt(va); vb = parseInt(vb); }
    else { va = va.toString().toLowerCase(); vb = vb.toString().toLowerCase(); }
    if (va < vb) return State.sortDir === 'asc' ? -1 :  1;
    if (va > vb) return State.sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  renderDocumentTable();
}

/* ════════════════════════════════════════
   MODULE 12 – DASHBOARD RENDER
════════════════════════════════════════ */
function renderDashboard() {
  const docs = State.allDocs;
  document.getElementById('statTotal').textContent   = docs.length;
  document.getElementById('statHigh').textContent    = docs.filter(d => d.Priority === 'High').length;
  document.getElementById('statSoon').textContent    = docs.filter(d => d.ExpiryStatus === 'Expiring Soon').length;
  document.getElementById('statExpired').textContent = docs.filter(d => d.ExpiryStatus === 'Expired').length;
  renderCharts();
  renderRecentList();
  renderQuickAlerts();
}

function buildCategoryPills() {
  const container = document.getElementById('categoryPills');
  const categories = [...new Set(State.allDocs.map(d => d.Category))].sort();
  container.innerHTML = categories.map(cat => {
    const count = State.allDocs.filter(d => d.Category === cat).length;
    const color = CATEGORY_COLORS[cat] || '#64748b';
    return `
      <div class="cat-pill" onclick="filterAndGo('Category','${cat}')">
        <span class="dot" style="background:${color};"></span>
        <span>${cat}</span>
        <span class="pill-count">${count}</span>
      </div>`;
  }).join('');
}

function renderRecentList() {
  const sorted = [...State.allDocs]
    .filter(d => d.LastUpdate)
    .sort((a, b) => new Date(b.LastUpdate) - new Date(a.LastUpdate))
    .slice(0, 5);

  const list = document.getElementById('recentList');
  list.innerHTML = sorted.map(doc => `
    <li onclick="openModal('${doc.DocumentID}')">
      <div class="mini-doc-icon" style="background:${hexWithAlpha(CATEGORY_COLORS[doc.Category]||'#64748b', 0.15)};">
        <i class="ph-duotone ph-file-text" style="color:${CATEGORY_COLORS[doc.Category]||'#64748b'};"></i>
      </div>
      <div class="mini-doc-info">
        <div class="mini-doc-name">${escapeHtml(doc.Name)}</div>
        <div class="mini-doc-meta">${doc.Category} · Updated ${formatDate(doc.LastUpdate)}</div>
      </div>
      <span class="${expiryClass(doc.ExpiryStatus)} expiry-badge" style="font-size:10px;padding:2px 7px;">${doc.ExpiryStatus}</span>
    </li>`).join('');
}

function renderQuickAlerts() {
  const urgent = State.allDocs.filter(d =>
    d.ExpiryStatus === 'Expired' || d.ExpiryStatus === 'Expiring Soon'
  ).slice(0, 5);

  const list = document.getElementById('quickAlertList');
  if (urgent.length === 0) {
    list.innerHTML = `<li style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
      <i class="ph-duotone ph-check-circle" style="font-size:28px;display:block;margin-bottom:6px;color:var(--green);"></i>
      No urgent alerts
    </li>`;
    return;
  }
  list.innerHTML = urgent.map(doc => `
    <li onclick="navigate('alerts')">
      <div class="mini-doc-icon" style="background:${doc.ExpiryStatus==='Expired'?'var(--red-bg)':'var(--amber-bg)'};">
        <i class="ph-duotone ph-${doc.ExpiryStatus==='Expired'?'x-circle':'clock-countdown'}"
           style="color:${doc.ExpiryStatus==='Expired'?'var(--red)':'var(--amber)'};"></i>
      </div>
      <div class="mini-doc-info">
        <div class="mini-doc-name">${escapeHtml(doc.Name)}</div>
        <div class="mini-doc-meta">${doc.ExpiryDate ? 'Expires: ' + formatDate(doc.ExpiryDate) : 'No expiry date'}</div>
      </div>
    </li>`).join('');
}

function updateBadges() {
  document.getElementById('totalBadge').textContent = State.allDocs.length;
  const urgent = State.allDocs.filter(d =>
    d.ExpiryStatus === 'Expired' || d.ExpiryStatus === 'Expiring Soon'
  ).length;
  const badge = document.getElementById('alertBadge');
  badge.textContent = urgent;
  badge.style.display = urgent > 0 ? '' : 'none';
}

/* ════════════════════════════════════════
   MODULE 13 – CHARTS
════════════════════════════════════════ */
function getChartDefaults() {
  const styles = getComputedStyle(document.documentElement);
  return {
    textColor:    styles.getPropertyValue('--text-secondary').trim(),
    mutedColor:   styles.getPropertyValue('--text-muted').trim(),
    borderColor:  styles.getPropertyValue('--border').trim(),
    surfaceColor: styles.getPropertyValue('--surface').trim(),
  };
}

function renderCharts() {
  renderCategoryChart();
  renderPriorityChart();
  renderExpiryTimeline();
}

function destroyCharts() {
  Object.values(State.charts).forEach(c => { if (c) c.destroy(); });
  State.charts = {};
}

function renderCategoryChart() {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  if (State.charts.category) State.charts.category.destroy();

  const counts = {};
  State.allDocs.forEach(d => { counts[d.Category] = (counts[d.Category] || 0) + 1; });
  const labels = Object.keys(counts);
  const data   = Object.values(counts);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#64748b');
  const d = getChartDefaults();

  State.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: d.surfaceColor, borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { color: d.textColor, font: { family: "'DM Sans'" }, boxWidth: 10, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} docs` } }
      }
    }
  });
}

function renderPriorityChart() {
  const ctx = document.getElementById('priorityChart');
  if (!ctx) return;
  if (State.charts.priority) State.charts.priority.destroy();

  const priorities = ['High', 'Medium', 'Low'];
  const data  = priorities.map(p => State.allDocs.filter(d => d.Priority === p).length);
  const colors = ['#ef4444', '#f59e0b', '#22c55e'];
  const d = getChartDefaults();

  State.charts.priority = new Chart(ctx, {
    type: 'bar',
    data: { labels: priorities, datasets: [{
      data, backgroundColor: colors.map(c => c + 'cc'),
      borderColor: colors, borderWidth: 2, borderRadius: 8, borderSkipped: false
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: d.textColor }, grid: { display: false } },
        y: { ticks: { color: d.textColor, stepSize: 1 }, grid: { color: d.borderColor } }
      }
    }
  });
}

function renderExpiryTimeline() {
  const ctx = document.getElementById('expiryChart');
  if (!ctx) return;
  if (State.charts.expiry) State.charts.expiry.destroy();

  const now = new Date();
  const upcoming = State.allDocs
    .filter(d => d.ExpiryDate && new Date(d.ExpiryDate) > now)
    .map(d => ({ name: d.Name, date: new Date(d.ExpiryDate) }))
    .sort((a, b) => a.date - b.date);

  const monthMap = {};
  upcoming.forEach(({ date }) => {
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    monthMap[key] = (monthMap[key] || 0) + 1;
  });

  const labels = Object.keys(monthMap).map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m-1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  });
  const data = Object.values(monthMap);
  const d = getChartDefaults();

  State.charts.expiry = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{
      label: 'Documents Expiring',
      data, backgroundColor: 'rgba(13,148,136,0.25)',
      borderColor: '#0d9488', borderWidth: 2, borderRadius: 6
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: d.textColor, font: { family: "'DM Sans'" } } },
        tooltip: { callbacks: { label: c => ` ${c.raw} document${c.raw>1?'s':''} expiring` } }
      },
      scales: {
        x: { ticks: { color: d.textColor }, grid: { color: d.borderColor } },
        y: { ticks: { color: d.textColor, stepSize: 1 }, grid: { color: d.borderColor } }
      }
    }
  });
}

/* ════════════════════════════════════════
   MODULE 14 – DOCUMENT TABLE RENDER
   Table is now compact (fewer columns).
   Hidden cols are shown in modal.
════════════════════════════════════════ */
function renderDocumentTable() {
  const tbody   = document.getElementById('docTableBody');
  const docs    = State.filteredDocs;
  const countEl = document.getElementById('resultsCount');

  countEl.textContent = `Showing ${docs.length} of ${State.allDocs.length} document${State.allDocs.length !== 1 ? 's' : ''}`;

  if (docs.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state">
          <i class="ph-duotone ph-magnifying-glass"></i>
          <p>No documents found</p>
          <span>Try adjusting your search or filters</span>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(doc => {
    const rowClass = doc.ExpiryStatus === 'Expired' ? 'row-expired'
                   : doc.ExpiryStatus === 'Expiring Soon' ? 'row-expiring'
                   : doc.Priority === 'High' ? 'row-high-priority' : '';

    // Count available downloads
    const dlCount = doc.GDrive ? Object.keys(doc.GDrive).length : 0;
    const dlBadge = dlCount > 0
      ? `<span class="dl-count-badge"><i class="ph-bold ph-download-simple"></i> ${dlCount}</span>`
      : `<span class="dl-count-badge empty">–</span>`;

    return `
    <tr class="${rowClass}" onclick="openModal('${doc.DocumentID}')">
      <td class="doc-id">${doc.DocumentID}</td>
      <td>
        <div class="doc-name-cell">
          <strong>${escapeHtml(doc.Name)}</strong>
          <span class="doc-type-sub">${escapeHtml(doc.Type || '')}</span>
        </div>
      </td>
      <td><span class="cat-chip" style="background:${hexWithAlpha(CATEGORY_COLORS[doc.Category]||'#64748b',0.15)};color:${CATEGORY_COLORS[doc.Category]||'#64748b'};">${escapeHtml(doc.Category)}</span></td>
      <td><span class="priority-badge ${doc.Priority}">${priorityDot(doc.Priority)} ${doc.Priority}</span></td>
      <td><span class="status-badge ${doc.Status}">${doc.Status}</span></td>
      <td>${doc.ExpiryDate ? formatDate(doc.ExpiryDate) : '<span style="color:var(--text-muted)">–</span>'}</td>
      <td><span class="expiry-badge ${expiryClass(doc.ExpiryStatus)}">${expiryIcon(doc.ExpiryStatus)} ${doc.ExpiryStatus}</span></td>
      <td onclick="event.stopPropagation()">
        <div class="action-btns">
          <button class="act-btn" title="View Details" onclick="openModal('${doc.DocumentID}')">
            <i class="ph-duotone ph-eye"></i>
          </button>
          ${dlCount > 0 ? `<button class="act-btn dl-btn" title="Downloads available" onclick="openModal('${doc.DocumentID}')">
            <i class="ph-duotone ph-download-simple"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ════════════════════════════════════════
   MODULE 15 – ALERTS PAGE RENDER
════════════════════════════════════════ */
function renderAlerts() {
  const expired  = State.allDocs.filter(d => d.ExpiryStatus === 'Expired');
  const expiring = State.allDocs.filter(d => d.ExpiryStatus === 'Expiring Soon');
  const pending  = State.allDocs.filter(d => d.Status === 'Pending');

  document.getElementById('expiredCountBadge').textContent = expired.length;
  document.getElementById('soonCountBadge').textContent    = expiring.length;
  document.getElementById('pendingCountBadge').textContent = pending.length;

  renderAlertCards('expiredCards',  expired,  'expired');
  renderAlertCards('soonCards',     expiring, 'expiring');
  renderAlertCards('pendingCards',  pending,  'pending');
}

function renderAlertCards(containerId, docs, type) {
  const container = document.getElementById(containerId);
  if (docs.length === 0) {
    container.innerHTML = `<div class="no-alerts">
      <i class="ph-duotone ph-check-circle" style="font-size:28px;display:block;margin-bottom:6px;color:var(--green);"></i>
      No ${type === 'pending' ? 'pending' : type} documents
    </div>`;
    return;
  }
  container.innerHTML = docs.map(doc => `
    <div class="alert-card ${type}" onclick="openModal('${doc.DocumentID}')">
      <div class="alert-card-top">
        <div>
          <div class="alert-doc-name">${escapeHtml(doc.Name)}</div>
          <div class="alert-doc-num">${escapeHtml(doc.DocumentNumber || '–')}</div>
        </div>
        <span class="priority-badge ${doc.Priority}" style="font-size:10px;">${doc.Priority}</span>
      </div>
      <div class="alert-meta">
        <div class="alert-row">
          <i class="ph-duotone ph-building-office"></i>
          <span><strong>Authority:</strong> ${escapeHtml(doc.Authority)}</span>
        </div>
        <div class="alert-row">
          <i class="ph-duotone ph-user"></i>
          <span><strong>Holder:</strong> ${escapeHtml(doc.HolderName)}</span>
        </div>
        ${doc.ExpiryDate ? `<div class="alert-row">
          <i class="ph-duotone ph-calendar-x"></i>
          <span><strong>Expiry:</strong> ${formatDate(doc.ExpiryDate)}</span>
        </div>` : ''}
        ${doc.Notes ? `<div class="alert-row">
          <i class="ph-duotone ph-note"></i>
          <span>${escapeHtml(doc.Notes.substring(0,60))}${doc.Notes.length>60?'…':''}</span>
        </div>` : ''}
      </div>
      <div class="alert-footer">
        <span>${escapeHtml(doc.Category)} · ${escapeHtml(doc.Type || '')}</span>
        <span class="expiry-badge ${expiryClass(doc.ExpiryStatus)}" style="font-size:10.5px;">${doc.ExpiryStatus}</span>
      </div>
    </div>`).join('');
}

/* ════════════════════════════════════════
   MODULE 16 – DOCUMENT DETAIL MODAL
   Now includes the Download Panel section.
════════════════════════════════════════ */
function openModal(docId) {
  const doc = State.allDocs.find(d => d.DocumentID === docId);
  if (!doc) return;

  document.getElementById('modalCat').textContent  = doc.Category;
  document.getElementById('modalName').textContent = doc.Name;

  const catColor = CATEGORY_COLORS[doc.Category] || '#64748b';
  document.getElementById('modalCat').style.cssText =
    `background:${hexWithAlpha(catColor,0.15)};color:${catColor};`;

  const showNum = !State.sensitive;

  // ── Build Download Panel HTML ──────────────────────────────
  let downloadPanelHTML = '';
  if (doc.GDrive && Object.keys(doc.GDrive).length > 0) {
    const pdfKeys = Object.keys(doc.GDrive).filter(k => k.startsWith('pdf'));
    const jpgKeys = Object.keys(doc.GDrive).filter(k => k.startsWith('jpg'));

    const buildGroup = (keys, groupLabel, groupColor, groupIcon) => {
      if (keys.length === 0) return '';
      const btns = keys.map(key => {
        const meta = GDRIVE_META[key] || { label: key, icon: 'ph-file', size: key };
        return `
          <a href="${escapeHtml(doc.GDrive[key])}" target="_blank" rel="noopener"
             class="dl-pill" title="Download ${meta.label}">
            <i class="ph-duotone ${meta.icon}"></i>
            <span class="dl-pill-size">${meta.size}</span>
          </a>`;
      }).join('');
      return `
        <div class="dl-group">
          <div class="dl-group-label">
            <i class="ph-bold ${groupIcon}" style="color:${groupColor};"></i>
            ${groupLabel}
          </div>
          <div class="dl-pills">${btns}</div>
        </div>`;
    };

    downloadPanelHTML = `
      <div class="modal-section-title"><i class="ph-bold ph-download-simple" style="margin-right:5px;"></i> Download Files</div>
      <div class="modal-field full">
        <label>Available formats from Google Drive</label>
        <div class="download-panel">
          ${buildGroup(pdfKeys, 'PDF', '#ef4444', 'ph-file-pdf')}
          ${buildGroup(jpgKeys, 'JPG / Image', '#3b82f6', 'ph-file-image')}
        </div>
      </div>`;
  }

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-grid">
      <div class="modal-section-title">Document Info</div>

      <div class="modal-field">
        <label>Document ID</label>
        <div class="field-val mono">${doc.DocumentID}</div>
      </div>
      <div class="modal-field">
        <label>Name</label>
        <div class="field-val">${escapeHtml(doc.Name)}</div>
      </div>
      <div class="modal-field">
        <label>Category</label>
        <div class="field-val">${escapeHtml(doc.Category)}</div>
      </div>
      <div class="modal-field">
        <label>Type</label>
        <div class="field-val">${escapeHtml(doc.Type || '–')}</div>
      </div>
      <div class="modal-field">
        <label>Document Number</label>
        <div class="field-val mono">${showNum ? escapeHtml(doc.DocumentNumber || '–') : '••••••••••'}</div>
      </div>
      <div class="modal-field">
        <label>Authority</label>
        <div class="field-val">${escapeHtml(doc.Authority || '–')}</div>
      </div>
      <div class="modal-field">
        <label>Priority</label>
        <div class="field-val"><span class="priority-badge ${doc.Priority}">${priorityDot(doc.Priority)} ${doc.Priority}</span></div>
      </div>
      <div class="modal-field">
        <label>Status</label>
        <div class="field-val"><span class="status-badge ${doc.Status}">${doc.Status}</span></div>
      </div>

      <div class="modal-section-title">Dates & Expiry</div>

      <div class="modal-field">
        <label>Initial Date</label>
        <div class="field-val">${formatDate(doc.InitialDate)}</div>
      </div>
      <div class="modal-field">
        <label>Last Updated</label>
        <div class="field-val">${formatDate(doc.LastUpdate)}</div>
      </div>
      <div class="modal-field">
        <label>Expiry Date</label>
        <div class="field-val ${!doc.ExpiryDate?'empty':''}">${doc.ExpiryDate ? formatDate(doc.ExpiryDate) : 'No Expiry'}</div>
      </div>
      <div class="modal-field">
        <label>Expiry Status</label>
        <div class="field-val"><span class="expiry-badge ${expiryClass(doc.ExpiryStatus)}">${expiryIcon(doc.ExpiryStatus)} ${doc.ExpiryStatus}</span></div>
      </div>

      <div class="modal-section-title">Holder Details</div>

      <div class="modal-field">
        <label>Holder Name</label>
        <div class="field-val">${escapeHtml(doc.HolderName || '–')}</div>
      </div>
      <div class="modal-field">
        <label>Father's Name</label>
        <div class="field-val">${escapeHtml(doc.FathersName || '–')}</div>
      </div>
      <div class="modal-field">
        <label>Contact</label>
        <div class="field-val mono">${showNum ? escapeHtml(doc.Contact||'–') : '••••••••••'}</div>
      </div>
      <div class="modal-field">
        <label>Email</label>
        <div class="field-val mono">${showNum ? escapeHtml(doc.Email||'–') : '••••••••••'}</div>
      </div>
      <div class="modal-field">
        <label>Nominee</label>
        <div class="field-val ${doc.Nominee==='N/A'?'empty':''}">${escapeHtml(doc.Nominee || '–')}</div>
      </div>
      <div class="modal-field">
        <label>Address</label>
        <div class="field-val">${escapeHtml(doc.Address || '–')}</div>
      </div>

      ${doc.Notes ? `
      <div class="modal-section-title">Notes</div>
      <div class="modal-field full">
        <label>Notes / Google Drive Links</label>
        <div class="field-val" style="white-space:pre-wrap;">${escapeHtml(doc.Notes)}</div>
      </div>` : ''}

      ${downloadPanelHTML}
    </div>`;

  document.getElementById('modalBackdrop').classList.add('open');
  document.getElementById('docModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('docModal').classList.remove('open');
  document.body.style.overflow = '';
}

/* ════════════════════════════════════════
   MODULE 17 – EXPORT CSV
════════════════════════════════════════ */
function exportCSV() {
  const cols = [
    'DocumentID','Name','Category','Priority','Status','Authority',
    'Type','DocumentNumber','Nominee','InitialDate','LastUpdate',
    'ExpiryDate','ExpiryStatus','Address','HolderName','FathersName',
    'Contact','Email','Notes'
  ];

  const header = cols.join(',');
  const rows = State.filteredDocs.map(doc =>
    cols.map(col => {
      const val = (doc[col] || '').toString().replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DocuVault_Export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ════════════════════════════════════════
   MODULE 18 – HELPERS & UTILITIES
════════════════════════════════════════ */
function formatDate(dateStr) {
  if (!dateStr) return '–';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return dateStr; }
}

function expiryClass(status) {
  const map = {
    'Valid':          'Valid',
    'Expiring Soon':  'Expiring Soon',
    'Expired':        'Expired',
    'No Expiry':      'No Expiry'
  };
  return map[status] || '';
}

function expiryIcon(status) {
  const icons = {
    'Valid':         '✓',
    'Expiring Soon': '⏳',
    'Expired':       '✗',
    'No Expiry':     '∞'
  };
  return icons[status] || '';
}

function priorityDot(p) {
  return p === 'High' ? '🔴' : p === 'Medium' ? '🟡' : '🟢';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ════════════════════════════════════════
   KEYBOARD SHORTCUTS
════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('globalSearch').focus();
  }
});

/* ════════════════════════════════════════
   BOOT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', loadData);
