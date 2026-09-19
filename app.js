/* ============================================================
   FinTrack – app.js
   Personal Finance App with Cash / Credit Card + Cashback
   ============================================================ */

'use strict';

// =========================================================
// 1. DATA LAYER & STORAGE
// =========================================================
const DB_KEY = 'fintrack_v3';

const DEFAULT_BANKS = [
  'Techcombank',
  'VPBank',
  'BIDV',
  'Vietcombank',
  'ACB',
  'MB Bank',
  'TPBank',
  'Shinhan',
  'HSBC',
  'Citibank',
  'Khác'
];

function loadDB() {
  let data = null;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (_) {}
  if (!data) {
    data = {
      transactions: [],
      cards: [
        {
          id: 'default-visa',
          name: 'Techcombank Visa',
          bank: 'Techcombank',
          last4: '8888',
          color: '#6c63ff',
          defaultCashback: 1,    // percent
          perks: { 'Ăn uống': 5, 'Di chuyển': 3, 'Du lịch': 5 }
        },
        {
          id: 'default-mc',
          name: 'VPBank MC',
          bank: 'VPBank',
          last4: '4321',
          color: '#f97316',
          defaultCashback: 1.5,
          perks: { 'Mua sắm': 4, 'Siêu thị': 3 }
        }
      ],
      banks: [...DEFAULT_BANKS]
    };
  }
  if (!data.banks || !Array.isArray(data.banks) || data.banks.length === 0) {
    data.banks = [...DEFAULT_BANKS];
  }
  return data;
}

function saveDB() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (_) {}
}

let db = loadDB();

// =========================================================
// 2. CONSTANTS
// =========================================================
const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Ăn uống', icon: '🍜', color: '#ef4444' },
  { id: 'transport', label: 'Di chuyển', icon: '🚗', color: '#f97316' },
  { id: 'shopping', label: 'Mua sắm', icon: '🛍️', color: '#8b5cf6' },
  { id: 'grocery', label: 'Siêu thị', icon: '🛒', color: '#06b6d4' },
  { id: 'health', label: 'Y tế', icon: '💊', color: '#10b981' },
  { id: 'bills', label: 'Hóa đơn', icon: '📄', color: '#6366f1' },
  { id: 'travel', label: 'Du lịch', icon: '✈️', color: '#ec4899' },
  { id: 'entertainment', label: 'Giải trí', icon: '🎮', color: '#a855f7' },
  { id: 'education', label: 'Học phí', icon: '📚', color: '#0ea5e9' },
  { id: 'fuel', label: 'Xăng xe', icon: '⛽', color: '#f59e0b' },
  { id: 'other_exp', label: 'Khác', icon: '📦', color: '#64748b' },
];

const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Lương', icon: '💼', color: '#10b981' },
  { id: 'bonus', label: 'Thưởng', icon: '🏆', color: '#f59e0b' },
  { id: 'freelance', label: 'Freelance', icon: '💻', color: '#8b5cf6' },
  { id: 'invest', label: 'Đầu tư', icon: '📈', color: '#3b82f6' },
  { id: 'other_inc', label: 'Khác', icon: '💵', color: '#6366f1' },
];

const ALL_CATS = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const PAGE_TITLES = {
  dashboard: 'Tổng quan',
  transactions: 'Giao dịch',
  cards: 'Thẻ tín dụng',
  cashback: 'Cashback',
  report: 'Báo cáo',
};

// =========================================================
// 3. UTILITIES
// =========================================================
function fmt(num) {
  if (num == null || isNaN(num)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' ₫';
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getCat(id) { return ALL_CATS.find(c => c.id === id) || { label: id, icon: '❓', color: '#555' }; }
function getCard(id) { return db.cards.find(c => c.id === id); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

// =========================================================
// 4. CASHBACK CALCULATION
// =========================================================
function calcCashback(tx) {
  if (tx.type === 'income') return 0;
  if (tx.method === 'cash') return 0;
  if (!tx.cardId) return 0;

  const card = getCard(tx.cardId);
  if (!card) return 0;

  const cat = getCat(tx.category).label;
  const pct = (card.perks && card.perks[cat] != null)
    ? card.perks[cat]
    : card.defaultCashback;

  return Math.round(tx.amount * pct / 100);
}

// =========================================================
// 5. NAVIGATION
// =========================================================
let currentPage = 'dashboard';

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  const navTarget = document.getElementById('nav-' + page);
  if (!target) return;
  target.classList.add('active');
  if (navTarget) navTarget.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  currentPage = page;
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'cards': renderCards(); break;
    case 'cashback': renderCashback(); break;
    case 'report': renderReport(); break;
  }
}

// =========================================================
// 6. CLOCK
// =========================================================
function updateClock() {
  const now = new Date();
  const hm = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const te = document.getElementById('sidebar-time');
  const de = document.getElementById('sidebar-date');
  if (te) te.textContent = hm;
  if (de) de.textContent = date;
}

// =========================================================
// 7. DASHBOARD
// =========================================================
function getDashboardStats() {
  const txs = db.transactions;
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const cashback = txs.reduce((s, t) => s + (t.cashback || 0), 0);
  const balance = income - expense;
  const cashTx = txs.filter(t => t.type === 'expense' && t.method === 'cash');
  const creditTx = txs.filter(t => t.type === 'expense' && t.method === 'credit');
  const cashTotal = cashTx.reduce((s, t) => s + t.amount, 0);
  const creditTotal = creditTx.reduce((s, t) => s + t.amount, 0);
  return { income, expense, cashback, balance, cashTotal, creditTotal, cashCount: cashTx.length, creditCount: creditTx.length };
}

function renderDashboard() {
  const stats = getDashboardStats();

  // Summary cards – all amounts in plain black
  document.getElementById('balance-display').textContent = fmt(stats.balance);
  document.getElementById('income-display').textContent  = fmt(stats.income);
  document.getElementById('expense-display').textContent = fmt(stats.expense);
  document.getElementById('income-count').textContent =
    db.transactions.filter(t => t.type === 'income').length + ' khoản';
  document.getElementById('expense-count').textContent =
    db.transactions.filter(t => t.type === 'expense').length + ' khoản';

  // Payment bars
  document.getElementById('cash-total').textContent   = fmt(stats.cashTotal);
  document.getElementById('credit-total').textContent = fmt(stats.creditTotal);
  const pmTotal = stats.cashTotal + stats.creditTotal || 1;
  document.getElementById('cash-bar').style.width   = (stats.cashTotal   / pmTotal * 100) + '%';
  document.getElementById('credit-bar').style.width = (stats.creditTotal / pmTotal * 100) + '%';

  // Donut chart + Legend + Accordion & Recent list
  renderDonutChart();
  renderRecentList();
}

// Donut Chart on Left, Legend on Right
function renderDonutChart() {
  const canvas = document.getElementById('donutChart');
  const legendEl = document.getElementById('donut-legend-list');
  const totalLbl = document.getElementById('donut-total-label');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 220;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const expenses = db.transactions.filter(t => t.type === 'expense');
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const totalExpense = sortedCats.reduce((s, [, v]) => s + v, 0);

  if (!sortedCats.length || totalExpense === 0) {
    ctx.fillStyle = '#000000';
    ctx.font = '600 14px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Chưa có chi tiêu', size / 2, size / 2);
    if (legendEl) legendEl.innerHTML = '<div class="donut-empty">Chưa có dữ liệu</div>';
    if (totalLbl) totalLbl.textContent = '';
    renderCategoryAccordion([], []);
    return;
  }

  if (totalLbl) totalLbl.textContent = 'Tổng: ' + fmt(totalExpense);

  // 2–3 tông màu cơ bản rõ nét: xanh dương #1E40AF, đỏ cam #DC2626, xanh hoàng gia #2563EB
  const PALETTE = ['#1E40AF', '#DC2626', '#2563EB'];
  let chartSlices = [];

  if (sortedCats.length <= 2) {
    chartSlices = sortedCats.map(([id, val], idx) => {
      const cat = getCat(id);
      return {
        id,
        label: cat.label,
        amount: val,
        pct: (val / totalExpense) * 100,
        color: PALETTE[idx % PALETTE.length]
      };
    });
  } else {
    // Top 2 danh mục chính + gom phần còn lại vào Khác
    const top2 = sortedCats.slice(0, 2);
    const rest = sortedCats.slice(2);
    const restAmount = rest.reduce((s, [, val]) => s + val, 0);

    chartSlices = top2.map(([id, val], idx) => {
      const cat = getCat(id);
      return {
        id,
        label: cat.label,
        amount: val,
        pct: (val / totalExpense) * 100,
        color: PALETTE[idx]
      };
    });

    if (restAmount > 0) {
      chartSlices.push({
        id: 'other',
        label: 'Khác',
        amount: restAmount,
        pct: (restAmount / totalExpense) * 100,
        color: PALETTE[2]
      });
    }
  }

  // Vẽ vành tròn thanh mảnh (outer R: 88, inner R: 70 -> độ dày 18px)
  const cx = size / 2;
  const cy = size / 2;
  const r = 88;
  const ri = 70;

  let startAngle = -Math.PI / 2;
  chartSlices.forEach(slice => {
    const sweep = (slice.amount / totalExpense) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
    ctx.arc(cx, cy, ri, startAngle + sweep, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    startAngle += sweep;
  });

  // Ở giữa vòng tròn ghi chữ: TỔNG và 100% bằng chữ đen đậm
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 15px Arial, Helvetica, sans-serif';
  ctx.fillText('TỔNG', cx, cy - 12);
  ctx.font = '700 18px Arial, Helvetica, sans-serif';
  ctx.fillText('100%', cx, cy + 12);

  // Danh sách chú thích bên cạnh biểu đồ: • Tên danh mục : Tỷ lệ %
  if (legendEl) {
    legendEl.innerHTML = chartSlices.map(slice => `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${slice.color};"></span>
        <span class="donut-legend-bullet">•</span>
        <span class="donut-legend-text"><strong>${slice.label}</strong> : ${slice.pct.toFixed(2)}%</span>
      </div>
    `).join('');
  }

  // Liệt kê các nhóm danh mục theo dạng thẻ gập/mở phẳng bên dưới biểu đồ
  renderCategoryAccordion(sortedCats, expenses);
}

// Thẻ gập/mở phẳng (Accordion) cho các nhóm danh mục kèm số tiền & số lượng kết quả
function renderCategoryAccordion(sortedCats, expenses) {
  const el = document.getElementById('category-accordion-list');
  if (!el) return;

  if (!sortedCats.length) {
    el.innerHTML = '<div class="donut-empty">Chưa có giao dịch chi tiêu</div>';
    return;
  }

  el.innerHTML = sortedCats.map(([catId, totalVal]) => {
    const cat = getCat(catId);
    const catTxs = expenses
      .filter(t => t.category === catId)
      .sort((a, b) => b.date.localeCompare(a.date));
    const txCount = catTxs.length;

    const txRowsHtml = catTxs.map(tx => {
      const card = tx.cardId ? getCard(tx.cardId) : null;
      const methodStr = card ? card.name : (tx.method === 'cash' ? 'Tiền mặt' : 'Thẻ tín dụng');
      return `<div class="acc-tx-row">
        <div class="acc-tx-left">
          <span class="acc-tx-desc">${tx.desc || cat.label}</span>
          <span class="acc-tx-meta">${fmtDate(tx.date)} · ${methodStr}</span>
        </div>
        <div class="acc-tx-amount">-${fmt(tx.amount)}</div>
      </div>`;
    }).join('');

    return `<div class="acc-item" data-cat="${catId}">
      <button type="button" class="acc-header" aria-expanded="false">
        <div class="acc-header-left">
          <span class="acc-icon">${cat.icon}</span>
          <span class="acc-label">${cat.label}</span>
          <span class="acc-count">(${txCount} kết quả)</span>
        </div>
        <div class="acc-header-right">
          <span class="acc-total">-${fmt(totalVal)}</span>
          <span class="acc-chevron">▼</span>
        </div>
      </button>
      <div class="acc-body">
        <div class="acc-body-content">
          ${txRowsHtml}
        </div>
      </div>
    </div>`;
  }).join('');

  // Xử lý sự kiện click gập/mở thẻ
  el.querySelectorAll('.acc-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.acc-item');
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      header.setAttribute('aria-expanded', !isOpen);
      const chevron = header.querySelector('.acc-chevron');
      if (chevron) chevron.textContent = !isOpen ? '▲' : '▼';
    });
  });
}

// Danh sách giao dịch gần đây – chữ đen đậm, số tiền căn phải (chi đỏ đậm -, thu xanh đậm +)
function renderRecentList() {
  const el = document.getElementById('recent-list');
  if (!el) return;
  const recent = [...db.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  if (!recent.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>Chưa có giao dịch nào</p>
      <button class="btn-add-first" id="btn-add-first">+ Thêm giao dịch</button>
    </div>`;
    document.getElementById('btn-add-first')?.addEventListener('click', openAddModal);
    return;
  }

  el.innerHTML = recent.map(tx => {
    const cat    = getCat(tx.category);
    const card   = tx.cardId ? getCard(tx.cardId) : null;
    const isExp  = tx.type === 'expense';
    const methodStr = card ? card.name : (tx.method === 'cash' ? 'Tiền mặt' : 'Thẻ tín dụng');
    const amtPrefix = isExp ? '-' : '+';
    const amtClass = isExp ? 'rl-exp' : 'rl-inc';
    return `<div class="rl-row">
      <div class="rl-left">
        <span class="rl-name">${tx.desc || cat.label}</span>
        <span class="rl-meta">${fmtDate(tx.date)} · ${cat.label} · ${methodStr}</span>
      </div>
      <div class="rl-amount ${amtClass}">${amtPrefix}${fmt(tx.amount)}</div>
    </div>`;
  }).join('');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderCategoryLegend(cats) {
  const el = document.getElementById('category-legend');
  if (!el) return;
  if (!cats.length) { el.innerHTML = ''; return; }
  el.innerHTML = cats.map(([id]) => {
    const cat = getCat(id);
    return `<div class="legend-item">
      <div class="legend-dot" style="background:${cat.color}"></div>
      <span>${cat.icon} ${cat.label}</span>
    </div>`;
  }).join('');
}

// =========================================================
// 9. TRANSACTIONS PAGE
// =========================================================
function renderTransactions() {
  populateCategoryFilter();
  filterAndRenderTable();
}

function populateCategoryFilter() {
  const sel = document.getElementById('filter-category');
  if (!sel) return;
  sel.innerHTML = '<option value="all">Tất cả danh mục</option>' +
    ALL_CATS.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

function filterAndRenderTable() {
  const typeF = document.getElementById('filter-type')?.value || 'all';
  const methodF = document.getElementById('filter-method')?.value || 'all';
  const catF = document.getElementById('filter-category')?.value || 'all';
  const monthF = document.getElementById('filter-month')?.value || '';
  const searchQ = (document.getElementById('search-tx')?.value || '').toLowerCase();

  let txs = [...db.transactions].sort((a, b) => b.date.localeCompare(a.date));

  if (typeF !== 'all') txs = txs.filter(t => t.type === typeF);
  if (methodF !== 'all') txs = txs.filter(t => t.method === methodF);
  if (catF !== 'all') txs = txs.filter(t => t.category === catF);
  if (monthF) txs = txs.filter(t => t.date.startsWith(monthF));
  if (searchQ) txs = txs.filter(t =>
    (t.desc || '').toLowerCase().includes(searchQ) ||
    getCat(t.category).label.toLowerCase().includes(searchQ)
  );

  const tbody = document.getElementById('tx-tbody');
  const empty = document.getElementById('tx-empty');
  if (!tbody) return;

  if (!txs.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = txs.map(tx => {
    const cat = getCat(tx.category);
    const card = tx.cardId ? getCard(tx.cardId) : null;
    const isIncome = tx.type === 'income';

    // Danh sách danh mục theo loại giao dịch
    const catList = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    // Inline dropdown chọn DANH MỤC
    const catSelectHtml = `
      <select class="tx-inline-select tx-inline-cat" data-id="${tx.id}" aria-label="Đổi danh mục">
        ${catList.map(c => `<option value="${c.id}" ${c.id === tx.category ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
      </select>
    `;

    // Inline dropdown chọn PHƯƠNG THỨC
    let methodSelectHtml = '';
    if (isIncome) {
      methodSelectHtml = `
        <select class="tx-inline-select tx-inline-method" data-id="${tx.id}" aria-label="Đổi phương thức">
          <option value="cash" selected>💵 Tiền mặt</option>
        </select>
      `;
    } else {
      const cardOptions = db.cards.map(c => {
        const isSelected = tx.method === 'credit' && tx.cardId === c.id;
        return `<option value="credit:${c.id}" ${isSelected ? 'selected' : ''}>💳 ${c.name}</option>`;
      }).join('');

      const isGenericCredit = tx.method === 'credit' && (!tx.cardId || !getCard(tx.cardId));
      const genericCreditOpt = (!db.cards.length || isGenericCredit)
        ? `<option value="credit" ${isGenericCredit ? 'selected' : ''}>💳 Thẻ tín dụng</option>`
        : '';

      methodSelectHtml = `
        <select class="tx-inline-select tx-inline-method" data-id="${tx.id}" aria-label="Đổi phương thức">
          <option value="cash" ${tx.method === 'cash' ? 'selected' : ''}>💵 Tiền mặt</option>
          ${cardOptions}
          ${genericCreditOpt}
        </select>
      `;
    }

    // Bank-statement amount: right-aligned, +/- prefix, dark semantic colors
    const amtClass = isIncome ? 'tx-amt tx-amt--income' : 'tx-amt tx-amt--expense';
    const amtPrefix = isIncome ? '+' : '-';

    return `<tr class="tx-row">
      <td class="tx-cell-date">${fmtDate(tx.date)}</td>
      <td class="tx-cell-desc">
        <span class="tx-name">${tx.desc || cat.label}</span>
        ${tx.note ? `<span class="tx-note">${tx.note}</span>` : ''}
      </td>
      <td class="tx-cell-cat">${catSelectHtml}</td>
      <td class="tx-cell-method">${methodSelectHtml}</td>
      <td class="tx-cell-amount">
        <span class="${amtClass}">${amtPrefix}${fmt(tx.amount)}</span>
        ${tx.cashback > 0 ? `<span class="tx-cashback-hint">Cashback +${fmt(tx.cashback)}</span>` : ''}
      </td>
      <td class="tx-cell-action">
        <button class="btn-delete-tx" data-id="${tx.id}" title="Xóa">✕</button>
      </td>
    </tr>`;
  }).join('');

  // Inline Category Change Listener
  tbody.querySelectorAll('.tx-inline-cat').forEach(sel => {
    sel.addEventListener('change', e => {
      const txId = sel.dataset.id;
      const newCatId = e.target.value;
      const tx = db.transactions.find(t => t.id === txId);
      if (tx) {
        tx.category = newCatId;
        if (tx.method === 'credit') {
          tx.cashback = calcCashback(tx);
        }
        saveDB();
        renderDashboard();
        showToast(`Đã cập nhật danh mục: ${getCat(newCatId).label}`, 'success');
        filterAndRenderTable();
      }
    });
  });

  // Inline Payment Method Change Listener
  tbody.querySelectorAll('.tx-inline-method').forEach(sel => {
    sel.addEventListener('change', e => {
      const txId = sel.dataset.id;
      const val = e.target.value;
      const tx = db.transactions.find(t => t.id === txId);
      if (tx) {
        if (val === 'cash') {
          tx.method = 'cash';
          tx.cardId = '';
          tx.cashback = 0;
        } else if (val.startsWith('credit:')) {
          tx.method = 'credit';
          tx.cardId = val.replace('credit:', '');
          tx.cashback = calcCashback(tx);
        } else {
          tx.method = 'credit';
          if (!tx.cardId && db.cards.length) tx.cardId = db.cards[0].id;
          tx.cashback = calcCashback(tx);
        }
        saveDB();
        renderDashboard();
        const card = tx.cardId ? getCard(tx.cardId) : null;
        const methodStr = card ? card.name : (tx.method === 'cash' ? 'Tiền mặt' : 'Thẻ tín dụng');
        showToast(`Đã cập nhật phương thức: ${methodStr}`, 'success');
        filterAndRenderTable();
      }
    });
  });

  // delete handlers
  tbody.querySelectorAll('.btn-delete-tx').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}

// =========================================================
// 10. CARDS PAGE
// =========================================================
function renderCards() {
  const grid = document.getElementById('cards-grid');
  if (!grid) return;

  if (!db.cards.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">💳</div><p>Chưa có thẻ nào</p></div>`;
    return;
  }

  grid.innerHTML = db.cards.map(card => {
    const cardCashback = db.transactions
      .filter(t => t.cardId === card.id)
      .reduce((s, t) => s + (t.cashback || 0), 0);
    const cardSpend = db.transactions
      .filter(t => t.cardId === card.id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const perksHtml = card.perks && Object.keys(card.perks).length
      ? `<div class="card-perks-list">${Object.entries(card.perks).map(([k, v]) =>
          `<span class="perk-tag">${k}: ${v}%</span>`
        ).join('')}</div>` : '';

    return `<div class="credit-card">
      <button class="card-delete" data-id="${card.id}" title="Xóa thẻ">✕</button>
      <div class="card-bank">${card.bank}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-number">•••• •••• •••• ${card.last4 || '????'}</div>
      <div class="card-meta">
        <div>
          <div class="card-cashback-rate">Cashback mặc định</div>
          <div class="card-cashback-val">${card.defaultCashback}%</div>
          <div class="card-total-cb">Tích lũy: ${fmt(cardCashback)}</div>
        </div>
        <div style="text-align:right">
          <div class="card-cashback-rate">Chi tiêu</div>
          <div class="card-cashback-val" style="font-size:1.1rem">${fmt(cardSpend)}</div>
        </div>
      </div>
      ${perksHtml}
    </div>`;
  }).join('');

  // delete card handlers
  grid.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Xóa thẻ này?')) {
        db.cards = db.cards.filter(c => c.id !== btn.dataset.id);
        saveDB();
        renderCards();
        populateCardSelect();
        showToast('Đã xóa thẻ', 'info');
      }
    });
  });

  renderPerksBuilder();
  populateBankSelect();
}

function renderPerksBuilder() {
  const builder = document.getElementById('perks-builder');
  if (!builder) return;
  // Keep existing rows
}

// =========================================================
// 10.1. BANK SELECTION & MANAGEMENT
// =========================================================
function populateBankSelect(selectedBank) {
  const sel = document.getElementById('new-card-bank');
  if (!sel) return;

  if (!db.banks || !Array.isArray(db.banks) || db.banks.length === 0) {
    db.banks = [...DEFAULT_BANKS];
    saveDB();
  }

  const currentVal = selectedBank !== undefined ? selectedBank : sel.value;

  sel.innerHTML = db.banks.map(b => `<option value="${b}">${b}</option>`).join('') +
    '<option value="__add_new__">+ Thêm ngân hàng khác...</option>';

  if (currentVal && (db.banks.includes(currentVal) || currentVal === '__add_new__')) {
    sel.value = currentVal;
  } else if (db.banks.length > 0) {
    sel.value = db.banks[0];
  }

  const customWrap = document.getElementById('custom-bank-wrap');
  if (customWrap && sel.value !== '__add_new__') {
    customWrap.style.display = 'none';
  }
}

function addBank(rawName) {
  const name = (rawName || '').trim();
  if (!name) {
    showToast('Vui lòng nhập tên ngân hàng', 'error');
    return false;
  }

  if (!db.banks) db.banks = [...DEFAULT_BANKS];

  const existing = db.banks.find(b => b.toLowerCase() === name.toLowerCase());
  if (existing) {
    populateBankSelect(existing);
    const customWrap = document.getElementById('custom-bank-wrap');
    if (customWrap) customWrap.style.display = 'none';
    const customInput = document.getElementById('custom-bank-name');
    if (customInput) customInput.value = '';
    const quickInput = document.getElementById('quick-add-bank-input');
    if (quickInput) quickInput.value = '';
    showToast(`Ngân hàng "${existing}" đã có trong danh sách`, 'info');
    return true;
  }

  const khacIndex = db.banks.findIndex(b => b.toLowerCase() === 'khác');
  if (khacIndex !== -1) {
    db.banks.splice(khacIndex, 0, name);
  } else {
    db.banks.push(name);
  }

  saveDB();
  populateBankSelect(name);

  const customWrap = document.getElementById('custom-bank-wrap');
  if (customWrap) customWrap.style.display = 'none';
  const customInput = document.getElementById('custom-bank-name');
  if (customInput) customInput.value = '';
  const quickInput = document.getElementById('quick-add-bank-input');
  if (quickInput) quickInput.value = '';

  renderBankManageList();
  showToast(`Đã thêm ngân hàng: ${name}`, 'success');
  return true;
}

function deleteBank(bankName) {
  if (!bankName) return;

  const usedByCards = db.cards.filter(c => c.bank === bankName);
  let confirmMsg = `Bạn có chắc muốn xóa ngân hàng "${bankName}" khỏi danh sách?`;
  if (usedByCards.length > 0) {
    confirmMsg = `Ngân hàng "${bankName}" đang được sử dụng bởi ${usedByCards.length} thẻ tín dụng. Bạn có chắc muốn xóa khỏi danh sách chọn?`;
  }

  if (!confirm(confirmMsg)) return;

  db.banks = db.banks.filter(b => b !== bankName);
  if (db.banks.length === 0) {
    db.banks = ['Khác'];
  }
  saveDB();
  populateBankSelect();
  renderBankManageList();
  showToast(`Đã xóa ngân hàng "${bankName}"`, 'info');
}

function openBankModal() {
  const overlay = document.getElementById('bank-modal-overlay');
  if (overlay) overlay.classList.add('open');
  renderBankManageList();
  const input = document.getElementById('quick-add-bank-input');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function closeBankModal() {
  document.getElementById('bank-modal-overlay')?.classList.remove('open');
}

function renderBankManageList() {
  const listEl = document.getElementById('bank-manage-list');
  if (!listEl) return;

  if (!db.banks || !db.banks.length) {
    listEl.innerHTML = '<div style="padding:0.75rem; text-align:center; font-size:14px; font-weight:600; color:#000000;">Chưa có ngân hàng nào</div>';
    return;
  }

  listEl.innerHTML = db.banks.map(bank => {
    const isUsed = db.cards.some(c => c.bank === bank);
    return `
      <div class="bank-manage-item">
        <span class="bank-name">
          ${bank}
          ${isUsed ? '<small>(đang dùng)</small>' : ''}
        </span>
        <button type="button" class="btn-delete-bank" data-bank="${bank}" title="Xóa ${bank}">✕</button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-delete-bank').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteBank(btn.dataset.bank);
    });
  });
}

// =========================================================
// 11. CASHBACK PAGE
// =========================================================
function renderCashback() {
  const total = db.transactions.reduce((s, t) => s + (t.cashback || 0), 0);
  const el = document.getElementById('cb-total');
  if (el) el.textContent = fmt(total);

  // By card
  const byCardEl = document.getElementById('cashback-by-card');
  if (byCardEl) {
    const byCard = {};
    db.transactions.filter(t => t.cashback > 0 && t.cardId).forEach(t => {
      if (!byCard[t.cardId]) byCard[t.cardId] = 0;
      byCard[t.cardId] += t.cashback;
    });
    if (!Object.keys(byCard).length) {
      byCardEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🎁</div><p>Chưa có cashback nào</p></div>`;
    } else {
      byCardEl.innerHTML = Object.entries(byCard).map(([cardId, amount]) => {
        const card = getCard(cardId);
        if (!card) return '';
        return `<div class="cashback-card-item">
          <div class="cashback-card-color" style="background:${card.color || '#000000'}"></div>
          <div class="cashback-card-info">
            <div class="name">${card.name}</div>
            <div class="label">${card.bank} •••• ${card.last4}</div>
            <div class="value">+${fmt(amount)}</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // List
  const listEl = document.getElementById('cashback-list');
  if (listEl) {
    const cbTxs = db.transactions
      .filter(t => t.cashback > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!cbTxs.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Chưa có lịch sử cashback</p></div>`;
    } else {
      listEl.innerHTML = cbTxs.map(tx => {
        const card = tx.cardId ? getCard(tx.cardId) : null;
        const cat = getCat(tx.category);
        return `<div class="cashback-list-item">
          <div class="cb-item-date">${fmtDate(tx.date)}</div>
          <div class="cb-item-info">
            <div class="cb-item-desc">${cat.icon} ${tx.desc || cat.label}</div>
            ${card ? `<div class="cb-item-card">💳 ${card.name}</div>` : ''}
          </div>
          <div class="cb-item-amount">+${fmt(tx.cashback)}</div>
        </div>`;
      }).join('');
    }
  }
}

// =========================================================
// 12. REPORT PAGE
// =========================================================
function renderReport() {
  renderMonthlyChart();
  renderCategoryChart();
  renderStatsSection();
}

function renderMonthlyChart() {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 400;
  const H = 200;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('vi-VN', { month: 'short' })
    });
  }
  const incomes = months.map(m =>
    db.transactions.filter(t => t.type === 'income' && t.date.startsWith(m.key)).reduce((s, t) => s + t.amount, 0)
  );
  const expenses = months.map(m =>
    db.transactions.filter(t => t.type === 'expense' && t.date.startsWith(m.key)).reduce((s, t) => s + t.amount, 0)
  );

  drawBarChart(ctx, W, H, months.map(m => m.label), [
    { data: incomes, color: '#16A34A', label: 'Thu' },
    { data: expenses, color: '#DC2626', label: 'Chi' },
  ]);
}

function drawBarChart(ctx, W, H, labels, datasets) {
  const pad = { top: 25, right: 10, bottom: 35, left: 10 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const n = labels.length;
  const groupW = chartW / n;
  const barW = (groupW - 16) / datasets.length;
  const maxVal = Math.max(...datasets.flatMap(d => d.data), 1);

  // Grid lines: solid black crisp lines
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  datasets.forEach((ds, di) => {
    ds.data.forEach((val, i) => {
      const x = pad.left + i * groupW + 8 + di * barW;
      const bH = (val / maxVal) * chartH;
      const y = pad.top + chartH - bH;
      ctx.fillStyle = ds.color;
      ctx.fillRect(x, y, barW - 3, bH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barW - 3, bH);
    });
  });

  // Labels: pure black, bold 13px
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const x = pad.left + i * groupW + groupW / 2;
    ctx.fillText(label, x, H - 10);
  });

  // Legend
  let lx = W - 120;
  datasets.forEach(ds => {
    ctx.fillStyle = ds.color;
    ctx.fillRect(lx, 6, 12, 10);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, 6, 12, 10);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ds.label, lx + 16, 15);
    lx += 55;
  });
}

function renderCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 300;
  const H = 250;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const expenses = db.transactions.filter(t => t.type === 'expense');
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = cats.reduce((s, [, v]) => s + v, 0) || 1;

  if (!cats.length) {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu', W / 2, H / 2);
    return;
  }

  const PALETTE = ['#1E40AF', '#DC2626', '#2563EB', '#16A34A', '#D97706'];
  const cx = W / 2, cy = H / 2 - 15, r = Math.min(W, H) / 2 - 30;
  let angle = -Math.PI / 2;
  cats.forEach(([id, val], idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const sweep = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    angle += sweep;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Chi tiêu', cx, cy - 6);
  ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
  ctx.fillText(fmt(total), cx, cy + 12);

  // Mini legend at bottom
  const legendY = H - 15;
  let lx = 10;
  cats.slice(0, 3).forEach(([id], idx) => {
    const cat = getCat(id);
    const color = PALETTE[idx % PALETTE.length];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx + 6, legendY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cat.label, lx + 15, legendY + 4);
    lx += 85;
  });
}

function renderStatsSection() {
  const el = document.getElementById('report-stats-content');
  if (!el) return;
  const txs = db.transactions;
  if (!txs.length) {
    el.innerHTML = '<p style="color:var(--text-muted)">Chưa có dữ liệu</p>';
    return;
  }
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const cashback = txs.reduce((s, t) => s + (t.cashback || 0), 0);
  const avgExpense = expense / (txs.filter(t => t.type === 'expense').length || 1);
  const maxExpense = txs.filter(t => t.type === 'expense').reduce((m, t) => Math.max(m, t.amount), 0);
  const creditPct = expense > 0
    ? Math.round(txs.filter(t => t.type === 'expense' && t.method === 'credit').reduce((s, t) => s + t.amount, 0) / expense * 100)
    : 0;

  el.innerHTML = `<div class="stats-grid">
    <div class="stat-item">
      <div class="stat-label">Tổng thu nhập</div>
      <div class="stat-value" style="color:var(--income-color)">${fmt(income)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Tổng chi tiêu</div>
      <div class="stat-value" style="color:var(--expense-color)">${fmt(expense)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Cashback tích lũy</div>
      <div class="stat-value" style="color:var(--cashback-color)">${fmt(cashback)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Chi tiêu trung bình</div>
      <div class="stat-value">${fmt(avgExpense)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Chi tiêu lớn nhất</div>
      <div class="stat-value">${fmt(maxExpense)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">% qua thẻ tín dụng</div>
      <div class="stat-value" style="color:var(--accent-violet)">${creditPct}%</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Số giao dịch</div>
      <div class="stat-value">${txs.length}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Số dư hiện tại</div>
      <div class="stat-value" style="color:var(--balance-color)">${fmt(income - expense)}</div>
    </div>
  </div>`;
}

// =========================================================
// 13. MODAL – ADD TRANSACTION
// =========================================================
let currentTxType = 'expense';
let currentMethod = 'cash';
let pendingDeleteId = null;

function openAddModal() {
  const overlay = document.getElementById('modal-overlay');
  const dateInput = document.getElementById('tx-date');
  if (dateInput) dateInput.value = todayISO();
  if (overlay) overlay.classList.add('open');
  populateCategorySelect(currentTxType);
  populateCardSelect();
  clearForm();
}
function closeAddModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
}

function clearForm() {
  ['tx-amount', 'tx-desc', 'tx-note', 'tx-cashback-override'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  hideCashbackPreview();
}

function populateCategorySelect(type) {
  const sel = document.getElementById('tx-category');
  if (!sel) return;
  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

function populateCardSelect() {
  const sel = document.getElementById('tx-card');
  if (!sel) return;
  if (!db.cards.length) {
    sel.innerHTML = '<option value="">Chưa có thẻ – hãy thêm thẻ trước</option>';
    return;
  }
  sel.innerHTML = db.cards.map(c =>
    `<option value="${c.id}">${c.name} (•••• ${c.last4}) – CB mặc định: ${c.defaultCashback}%</option>`
  ).join('');
}

function updateCashbackPreview() {
  const preview = document.getElementById('cashback-preview');
  const amountEl = document.getElementById('cashback-preview-amount');
  const pctEl = document.getElementById('cashback-preview-pct');

  if (currentMethod !== 'credit' || currentTxType === 'income') {
    hideCashbackPreview();
    return;
  }

  const amount = parseFloat(document.getElementById('tx-amount')?.value) || 0;
  const cardId = document.getElementById('tx-card')?.value;
  const catId = document.getElementById('tx-category')?.value;

  if (!cardId || !amount) { hideCashbackPreview(); return; }

  const card = getCard(cardId);
  if (!card) { hideCashbackPreview(); return; }

  const catLabel = getCat(catId).label;
  const pct = (card.perks && card.perks[catLabel] != null) ? card.perks[catLabel] : card.defaultCashback;
  const cb = Math.round(amount * pct / 100);

  if (preview) preview.style.display = 'flex';
  if (amountEl) amountEl.textContent = fmt(cb);
  if (pctEl) pctEl.textContent = pct + '%';
}

function hideCashbackPreview() {
  const preview = document.getElementById('cashback-preview');
  if (preview) preview.style.display = 'none';
}

function saveTx() {
  const amount = parseFloat(document.getElementById('tx-amount')?.value);
  const date = document.getElementById('tx-date')?.value;
  const desc = document.getElementById('tx-desc')?.value.trim();
  const category = document.getElementById('tx-category')?.value;
  const note = document.getElementById('tx-note')?.value.trim();
  const cardId = currentMethod === 'credit' ? (document.getElementById('tx-card')?.value || '') : '';
  const overrideStr = document.getElementById('tx-cashback-override')?.value;

  if (!amount || amount <= 0) { showToast('Vui lòng nhập số tiền hợp lệ', 'error'); return; }
  if (!date) { showToast('Vui lòng chọn ngày', 'error'); return; }

  const tx = {
    id: uid(),
    type: currentTxType,
    amount,
    date,
    desc,
    category,
    method: currentMethod,
    cardId,
    note,
    cashback: 0,
    createdAt: new Date().toISOString(),
  };

  if (overrideStr !== '' && !isNaN(parseFloat(overrideStr))) {
    tx.cashback = parseFloat(overrideStr);
  } else {
    tx.cashback = calcCashback(tx);
  }

  db.transactions.push(tx);
  saveDB();
  closeAddModal();
  renderPage(currentPage);
  showToast(
    `Đã thêm ${tx.type === 'expense' ? 'chi tiêu' : 'thu nhập'} ${fmt(amount)}` +
    (tx.cashback > 0 ? ` · Cashback +${fmt(tx.cashback)}` : ''),
    'success'
  );
}

// =========================================================
// 14. CARDS MANAGEMENT
// =========================================================
let perkRows = [];

function addPerkRow(cat = '', pct = '') {
  perkRows.push({ cat, pct });
  renderPerkRows();
}

function renderPerkRows() {
  const builder = document.getElementById('perks-builder');
  if (!builder) return;
  const allCatLabels = ALL_CATS.map(c => c.label);
  builder.innerHTML = perkRows.map((row, i) => `
    <div class="perk-row">
      <select class="form-control perk-cat" data-idx="${i}">
        ${allCatLabels.map(l => `<option value="${l}" ${l === row.cat ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <input type="number" class="form-control perk-pct" data-idx="${i}" value="${row.pct}" placeholder="%" min="0" max="100" style="width:80px;flex:0 0 80px" />
      <button class="btn-remove-perk" data-idx="${i}">✕</button>
    </div>
  `).join('');

  builder.querySelectorAll('.perk-cat').forEach(sel => {
    sel.addEventListener('change', e => { perkRows[+e.target.dataset.idx].cat = e.target.value; });
  });
  builder.querySelectorAll('.perk-pct').forEach(inp => {
    inp.addEventListener('input', e => { perkRows[+e.target.dataset.idx].pct = e.target.value; });
  });
  builder.querySelectorAll('.btn-remove-perk').forEach(btn => {
    btn.addEventListener('click', e => {
      perkRows.splice(+btn.dataset.idx, 1);
      renderPerkRows();
    });
  });
}

function addCard() {
  const name = document.getElementById('new-card-name')?.value.trim();
  let bank = document.getElementById('new-card-bank')?.value;
  const last4 = document.getElementById('new-card-last4')?.value.trim();
  const color = document.getElementById('new-card-color')?.value || '#6c63ff';
  const defaultCb = parseFloat(document.getElementById('new-card-cashback')?.value) || 1;

  if (!name) { showToast('Vui lòng nhập tên thẻ', 'error'); return; }

  // Nếu chọn "Thêm ngân hàng khác..." thì lấy tên từ ô nhập tùy chỉnh
  if (bank === '__add_new__') {
    const customBank = document.getElementById('custom-bank-name')?.value.trim();
    if (!customBank) {
      showToast('Vui lòng nhập tên ngân hàng mới hoặc chọn từ danh sách', 'error');
      return;
    }
    addBank(customBank);
    bank = customBank;
  }

  const perks = {};
  perkRows.forEach(row => {
    if (row.cat && row.pct !== '') perks[row.cat] = parseFloat(row.pct);
  });

  const card = { id: uid(), name, bank, last4, color, defaultCashback: defaultCb, perks };
  db.cards.push(card);
  saveDB();
  perkRows = [];
  // Reset form
  ['new-card-name', 'new-card-last4', 'custom-bank-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const customWrap = document.getElementById('custom-bank-wrap');
  if (customWrap) customWrap.style.display = 'none';

  const cb = document.getElementById('new-card-cashback');
  if (cb) cb.value = '1';
  renderPerkRows();
  renderCards();
  populateCardSelect();
  showToast('Đã thêm thẻ ' + name, 'success');
}

// =========================================================
// 15. DELETE
// =========================================================
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-overlay')?.classList.add('open');
}

function executeDelete() {
  if (!pendingDeleteId) return;
  db.transactions = db.transactions.filter(t => t.id !== pendingDeleteId);
  saveDB();
  pendingDeleteId = null;
  document.getElementById('confirm-overlay')?.classList.remove('open');
  renderPage(currentPage);
  showToast('Đã xóa giao dịch', 'info');
}

// =========================================================
// 16. TOAST (Thông báo nổi tối ưu: nút ✕, giới hạn 3, 3 giây tự biến mất)
// =========================================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Giới hạn hiển thị: Chỉ giữ tối đa 2 thông báo cũ để khi thêm mới là tối đa 3
  const currentToasts = Array.from(container.querySelectorAll('.toast:not(.removing)'));
  if (currentToasts.length >= 3) {
    const toRemoveCount = currentToasts.length - 2;
    for (let i = 0; i < toRemoveCount; i++) {
      dismissToast(currentToasts[i]);
    }
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-msg">${msg}</span>
    </div>
    <button type="button" class="btn-toast-close" title="Tắt thông báo" aria-label="Đóng">✕</button>
  `;

  container.appendChild(toast);

  // Nút tắt thủ công ✕
  const closeBtn = toast.querySelector('.btn-toast-close');
  closeBtn?.addEventListener('click', () => {
    dismissToast(toast);
  });

  // Tự động mờ dần và biến mất sau 3 giây (3000ms)
  const timer = setTimeout(() => {
    dismissToast(toast);
  }, 3000);

  toast._dismissTimer = timer;
}

function dismissToast(toastEl) {
  if (!toastEl || toastEl.classList.contains('removing')) return;
  if (toastEl._dismissTimer) clearTimeout(toastEl._dismissTimer);
  toastEl.classList.add('removing');
  setTimeout(() => {
    toastEl.remove();
  }, 250);
}

// =========================================================
// 17. SEED DATA (for demo)
// =========================================================
function seedDemoData() {
  if (db.transactions.length > 0) return; // already has data
  const today = new Date();
  const demos = [
    { type: 'income', amount: 20000000, date: offset(today, -25), desc: 'Lương tháng 9', category: 'salary', method: 'cash' },
    { type: 'income', amount: 3000000, date: offset(today, -20), desc: 'Thưởng dự án', category: 'bonus', method: 'cash' },
    { type: 'expense', amount: 450000, date: offset(today, -22), desc: 'Bữa tối gia đình', category: 'food', method: 'credit', cardId: db.cards[0]?.id },
    { type: 'expense', amount: 1200000, date: offset(today, -18), desc: 'Mua đồ siêu thị', category: 'grocery', method: 'credit', cardId: db.cards[1]?.id },
    { type: 'expense', amount: 300000, date: offset(today, -15), desc: 'GrabCar đi công tác', category: 'transport', method: 'credit', cardId: db.cards[0]?.id },
    { type: 'expense', amount: 850000, date: offset(today, -14), desc: 'Mua quần áo', category: 'shopping', method: 'credit', cardId: db.cards[1]?.id },
    { type: 'expense', amount: 500000, date: offset(today, -12), desc: 'Tiền điện nước', category: 'bills', method: 'cash' },
    { type: 'expense', amount: 250000, date: offset(today, -10), desc: 'Ăn trưa công ty', category: 'food', method: 'cash' },
    { type: 'expense', amount: 2500000, date: offset(today, -8), desc: 'Đặt vé máy bay', category: 'travel', method: 'credit', cardId: db.cards[0]?.id },
    { type: 'expense', amount: 180000, date: offset(today, -5), desc: 'Đổ xăng xe', category: 'fuel', method: 'cash' },
    { type: 'expense', amount: 350000, date: offset(today, -3), desc: 'Netflix + Spotify', category: 'entertainment', method: 'credit', cardId: db.cards[0]?.id },
    { type: 'expense', amount: 750000, date: offset(today, -1), desc: 'Khám bệnh định kỳ', category: 'health', method: 'cash' },
  ];

  demos.forEach(d => {
    const tx = { id: uid(), ...d, note: '', cashback: 0, createdAt: new Date().toISOString() };
    tx.cashback = calcCashback(tx);
    db.transactions.push(tx);
  });
  saveDB();
}

function offset(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// =========================================================
// 18. EVENT LISTENERS & INIT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {

  // Seed demo
  seedDemoData();

  // Clock
  updateClock();
  setInterval(updateClock, 30000);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigate(item.dataset.page);
      // close sidebar on mobile
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
      }
    });
  });

  // "See all" links
  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.classList.contains('nav-item') || el.classList.contains('period-tab')) return;
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.page);
    });
  });

  // Mobile menu
  document.getElementById('btn-menu')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Add transaction button
  document.getElementById('btn-open-add')?.addEventListener('click', openAddModal);

  // Modal close
  document.getElementById('btn-close-modal')?.addEventListener('click', closeAddModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeAddModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
  });

  // Type tabs
  document.querySelectorAll('.type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTxType = tab.dataset.type;
      populateCategorySelect(currentTxType);
      // Hide credit option for income
      const creditGroup = document.getElementById('credit-card-group');
      const methodCredit = document.getElementById('method-credit');
      if (currentTxType === 'income') {
        if (methodCredit) methodCredit.style.display = 'none';
        currentMethod = 'cash';
        document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('method-cash')?.classList.add('active');
        if (creditGroup) creditGroup.style.display = 'none';
        hideCashbackPreview();
      } else {
        if (methodCredit) methodCredit.style.display = '';
      }
    });
  });

  // Payment method tabs
  document.querySelectorAll('.method-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMethod = tab.dataset.method;
      const creditGroup = document.getElementById('credit-card-group');
      if (currentMethod === 'credit') {
        if (creditGroup) creditGroup.style.display = 'block';
        updateCashbackPreview();
      } else {
        if (creditGroup) creditGroup.style.display = 'none';
        hideCashbackPreview();
      }
    });
  });

  // Cashback preview updates
  ['tx-amount', 'tx-category', 'tx-card'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateCashbackPreview);
    document.getElementById(id)?.addEventListener('change', updateCashbackPreview);
  });

  // Save transaction
  document.getElementById('btn-save-tx')?.addEventListener('click', saveTx);

  // Delete confirm
  document.getElementById('btn-close-confirm')?.addEventListener('click', () => {
    document.getElementById('confirm-overlay')?.classList.remove('open');
  });
  document.getElementById('btn-cancel-confirm')?.addEventListener('click', () => {
    document.getElementById('confirm-overlay')?.classList.remove('open');
  });
  document.getElementById('btn-confirm-delete')?.addEventListener('click', executeDelete);
  document.getElementById('confirm-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget)
      document.getElementById('confirm-overlay')?.classList.remove('open');
  });

  // Filters
  ['filter-type', 'filter-method', 'filter-category', 'filter-month', 'search-tx'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', filterAndRenderTable);
    document.getElementById(id)?.addEventListener('change', filterAndRenderTable);
  });

  // Add card
  document.getElementById('btn-add-card')?.addEventListener('click', addCard);
  document.getElementById('btn-add-perk')?.addEventListener('click', () => addPerkRow());

  // Bank Select & Dynamic Add/Delete listeners
  const bankSelect = document.getElementById('new-card-bank');
  const customBankWrap = document.getElementById('custom-bank-wrap');
  const customBankInput = document.getElementById('custom-bank-name');

  bankSelect?.addEventListener('change', e => {
    if (e.target.value === '__add_new__') {
      if (customBankWrap) customBankWrap.style.display = 'block';
      if (customBankInput) {
        customBankInput.value = '';
        customBankInput.focus();
      }
    } else {
      if (customBankWrap) customBankWrap.style.display = 'none';
    }
  });

  // Save custom bank from inline input
  document.getElementById('btn-save-custom-bank')?.addEventListener('click', () => {
    const val = customBankInput?.value.trim();
    if (val) {
      addBank(val);
    } else {
      showToast('Vui lòng nhập tên ngân hàng', 'error');
    }
  });

  // Cancel custom bank inline input
  document.getElementById('btn-cancel-custom-bank')?.addEventListener('click', () => {
    if (customBankWrap) customBankWrap.style.display = 'none';
    if (customBankInput) customBankInput.value = '';
    populateBankSelect();
  });

  // Enter key on custom bank input
  customBankInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-save-custom-bank')?.click();
    }
  });

  // Manage banks button -> open modal
  document.getElementById('btn-manage-banks')?.addEventListener('click', openBankModal);
  document.getElementById('btn-close-bank-modal')?.addEventListener('click', closeBankModal);
  document.getElementById('btn-done-bank-modal')?.addEventListener('click', closeBankModal);
  document.getElementById('bank-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBankModal();
  });

  // Quick add bank inside modal
  const quickAddBtn = document.getElementById('btn-quick-add-bank');
  const quickAddInput = document.getElementById('quick-add-bank-input');
  quickAddBtn?.addEventListener('click', () => {
    const val = quickAddInput?.value.trim();
    if (val) {
      addBank(val);
      if (quickAddInput) {
        quickAddInput.value = '';
        quickAddInput.focus();
      }
    } else {
      showToast('Vui lòng nhập tên ngân hàng', 'error');
    }
  });

  quickAddInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      quickAddBtn?.click();
    }
  });

  // Populate bank select on init
  populateBankSelect();

  // Period tabs
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      expenseChartState = tab.dataset.period;
      renderExpenseChart();
    });
  });

  // Resize -> redraw charts
  window.addEventListener('resize', () => {
    if (currentPage === 'dashboard') renderDonutChart();
    if (currentPage === 'report') renderReport();
  });

  // Initial render
  navigate('dashboard');
});
