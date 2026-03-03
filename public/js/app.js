// ============================================
// MoneyTrack — Dashboard Application Logic
// ============================================

(function () {
    // ---- State ----
    let categoryChart = null;
    let spendingChart = null;
    let timeRange = 'monthly'; // monthly | quarterly | yearly

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const loadingOverlay = $('#loading-overlay');
    const userEmail = $('#user-email');
    const userAvatar = $('#user-avatar');
    const logoutBtn = $('#logout-btn');
    const totalIncome = $('#total-income');
    const totalExpenses = $('#total-expenses');
    const currentBalance = $('#current-balance');
    const balanceChange = $('#balance-change');
    const incomeChange = $('#income-change');
    const expenseChange = $('#expense-change');

    // ---- Sidebar ----
    const sidebar = $('#sidebar');
    const hamburgerBtn = $('#hamburger-btn');
    const sidebarClose = $('#sidebar-close');

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => sidebar.classList.add('open'));
    }
    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // ---- Helpers ----
    function formatCurrency(amount) {
        const num = Number(amount);
        if (num >= 100000) {
            return '₹' + (num / 100000).toFixed(2) + 'L';
        }
        if (num >= 1000) {
            return '₹' + (num / 1000).toFixed(num >= 10000 ? 1 : 2) + 'k';
        }
        return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatCurrencyFull(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function getMonthLabel(monthStr) {
        const [year, month] = monthStr.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('en-IN', { month: 'short' });
    }

    function getMonthsForRange() {
        if (timeRange === 'quarterly') return 3;
        if (timeRange === 'yearly') return 12;
        return 1;
    }

    const categoryEmojis = {
        'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Entertainment': '🎬',
        'Utilities': '⚡', 'Salary': '💼', 'Other': '📦',
    };

    const categoryColors = {
        'Food': '#f97316', 'Transport': '#3b82f6', 'Rent': '#a855f7',
        'Entertainment': '#ec4899', 'Utilities': '#eab308', 'Salary': '#22c55e', 'Other': '#6b7280',
    };

    function showToast(message, type = 'success') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ---- Auth Check ----
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) { window.location.href = '/'; return false; }
            const data = await res.json();
            if (userEmail) userEmail.textContent = data.user.email;
            if (userAvatar) userAvatar.textContent = data.user.email.charAt(0).toUpperCase();

            // Update greeting
            const greetingEl = $('#greeting-text');
            if (greetingEl) {
                const hour = new Date().getHours();
                let greet = 'Good evening';
                if (hour < 12) greet = 'Good morning';
                else if (hour < 17) greet = 'Good afternoon';
                const name = data.user.email.split('@')[0];
                greetingEl.textContent = `${greet}, ${name}! Your finances are looking solid today.`;
            }

            return true;
        } catch {
            window.location.href = '/';
            return false;
        }
    }

    // ---- Logout ----
    logoutBtn.addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/'; }
    });

    // ---- Time Filter Tabs ----
    const timeFilterTabs = $('#time-filter-tabs');
    if (timeFilterTabs) {
        timeFilterTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.time-tab');
            if (!tab) return;
            $$('.time-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            timeRange = tab.dataset.range;
            refreshAll();
        });
    }

    // ---- Sparkline Drawing ----
    function drawSparkline(canvasId, data, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !data.length) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 4;

        ctx.clearRect(0, 0, w, h);

        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;

        const points = data.map((v, i) => ({
            x: padding + (i / (data.length - 1 || 1)) * (w - padding * 2),
            y: h - padding - ((v - min) / range) * (h - padding * 2),
        }));

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '00');

        ctx.beginPath();
        ctx.moveTo(points[0].x, h);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const cx = (points[i - 1].x + points[i].x) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cx, (points[i - 1].y + points[i].y) / 2);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // End dot
        const last = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    // ---- Dashboard Summary ----
    async function loadSummary() {
        try {
            const month = getCurrentMonth();
            const res = await fetch(`/api/dashboard/summary?month=${month}`);
            const data = await res.json();

            totalIncome.textContent = formatCurrencyFull(data.totalIncome);
            totalExpenses.textContent = formatCurrencyFull(data.totalExpenses);
            currentBalance.textContent = formatCurrencyFull(data.balance);
            currentBalance.style.color = data.balance >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)';
        } catch (err) {
            console.error('Failed to load summary:', err);
        }
    }

    // ---- Spending Over Time (Line Chart) ----
    async function loadSpendingChart() {
        try {
            const months = timeRange === 'yearly' ? 12 : timeRange === 'quarterly' ? 3 : 6;
            const res = await fetch(`/api/dashboard/monthly?months=${months}`);
            const data = await res.json();
            if (!res.ok || !data.monthly) throw new Error(data.error || 'Failed to load spending data');

            const labels = data.monthly.map(m => getMonthLabel(m.month));
            const incomeData = data.monthly.map(m => m.income);
            const expenseData = data.monthly.map(m => m.expense);

            const ctx = document.getElementById('spending-chart').getContext('2d');

            if (spendingChart) spendingChart.destroy();

            if (labels.length === 0) {
                ctx.font = '14px Inter';
                ctx.fillStyle = '#5e5e6e';
                ctx.textAlign = 'center';
                ctx.fillText('No data yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }

            // Draw sparklines with monthly data
            drawSparkline('sparkline-balance', data.monthly.map(m => m.income - m.expense), '#60a5fa');
            drawSparkline('sparkline-income', incomeData, '#34d399');
            drawSparkline('sparkline-expenses', expenseData, '#f87171');

            // Calculate percentage changes for badges
            if (data.monthly.length >= 2) {
                const last = data.monthly[data.monthly.length - 1];
                const prev = data.monthly[data.monthly.length - 2];

                const incomePct = prev.income > 0 ? (((last.income - prev.income) / prev.income) * 100).toFixed(1) : '0.0';
                const expensePct = prev.expense > 0 ? (((last.expense - prev.expense) / prev.expense) * 100).toFixed(1) : '0.0';
                const balLast = last.income - last.expense;
                const balPrev = prev.income - prev.expense;
                const balPct = Math.abs(balPrev) > 0 ? (((balLast - balPrev) / Math.abs(balPrev)) * 100).toFixed(1) : '0.0';

                if (incomeChange) {
                    incomeChange.textContent = (incomePct >= 0 ? '+' : '') + incomePct + '%';
                    incomeChange.className = 'card-change ' + (incomePct >= 0 ? 'positive' : 'negative');
                }
                if (expenseChange) {
                    expenseChange.textContent = (expensePct >= 0 ? '+' : '') + expensePct + '%';
                    expenseChange.className = 'card-change ' + (expensePct <= 0 ? 'positive' : 'negative');
                }
                if (balanceChange) {
                    balanceChange.textContent = (balPct >= 0 ? '+' : '') + balPct + '%';
                    balanceChange.className = 'card-change ' + (balPct >= 0 ? 'positive' : 'negative');
                }
            }

            spendingChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Income',
                            data: incomeData,
                            borderColor: '#34d399',
                            backgroundColor: 'rgba(52, 211, 153, 0.1)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: 3,
                            pointBackgroundColor: '#34d399',
                            pointBorderColor: '#12121a',
                            pointBorderWidth: 2,
                        },
                        {
                            label: 'Expenses',
                            data: expenseData,
                            borderColor: '#f87171',
                            backgroundColor: 'rgba(248, 113, 113, 0.1)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: 3,
                            pointBackgroundColor: '#f87171',
                            pointBorderColor: '#12121a',
                            pointBorderWidth: 2,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                            ticks: { color: '#5e5e6e', font: { family: 'Inter', size: 11 } },
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                            ticks: {
                                color: '#5e5e6e',
                                font: { family: 'Inter', size: 11 },
                                callback: (v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
                            },
                            beginAtZero: true,
                        },
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#9898a6',
                                font: { family: 'Inter', size: 12 },
                                usePointStyle: true,
                                pointStyleWidth: 10,
                                padding: 16,
                            },
                        },
                        tooltip: {
                            backgroundColor: '#1a1a2e',
                            titleColor: '#f0f0f5',
                            bodyColor: '#9898a6',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyFull(ctx.parsed.y)}`,
                            },
                        },
                    },
                },
            });
        } catch (err) {
            console.error('Failed to load spending chart:', err);
        }
    }

    // ---- Category Chart ----
    async function loadCategoryChart() {
        try {
            const month = getCurrentMonth();
            const res = await fetch(`/api/dashboard/categories?month=${month}`);
            const data = await res.json();
            if (!res.ok || !data.categories) throw new Error(data.error || 'Failed to load category data');

            const labels = data.categories.map(c => c.category);
            const values = data.categories.map(c => c.total);
            const colors = labels.map(l => categoryColors[l] || '#6b7280');
            const total = values.reduce((a, b) => a + b, 0);

            const ctx = document.getElementById('category-chart').getContext('2d');

            if (categoryChart) categoryChart.destroy();

            if (labels.length === 0) {
                ctx.font = '14px Inter';
                ctx.fillStyle = '#5e5e6e';
                ctx.textAlign = 'center';
                ctx.fillText('No expenses this month', ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }

            categoryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderColor: '#12121a',
                        borderWidth: 3,
                        hoverBorderWidth: 0,
                        hoverOffset: 8,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#9898a6',
                                font: { family: 'Inter', size: 12 },
                                padding: 14,
                                usePointStyle: true,
                                pointStyleWidth: 10,
                                generateLabels: function (chart) {
                                    const data = chart.data;
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        return {
                                            text: `${categoryEmojis[label] || ''} ${label}  ₹${value.toLocaleString()}`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: 'transparent',
                                            index: i,
                                            hidden: false,
                                            pointStyle: 'circle',
                                        };
                                    });
                                },
                            },
                        },
                        tooltip: {
                            backgroundColor: '#1a1a2e',
                            titleColor: '#f0f0f5',
                            bodyColor: '#9898a6',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                label: (ctx) => ` ${formatCurrencyFull(ctx.parsed)}`,
                            },
                        },
                    },
                },
                plugins: [{
                    id: 'centerText',
                    beforeDraw: function (chart) {
                        const { width, height, ctx } = chart;
                        ctx.restore();
                        const fontSize = (height / 10).toFixed(2);
                        ctx.font = `700 ${fontSize}px Inter`;
                        ctx.textBaseline = 'middle';
                        ctx.textAlign = 'center';

                        const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                        const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                        ctx.fillStyle = '#f0f0f5';
                        const totalText = '₹' + (total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total.toFixed(0));
                        ctx.fillText(totalText, centerX, centerY);
                        ctx.save();
                    },
                }],
            });
        } catch (err) {
            console.error('Failed to load category chart:', err);
        }
    }

    // ---- Recent Transactions ----
    async function loadRecentTransactions() {
        try {
            const res = await fetch('/api/transactions?page=1&limit=5&sort=desc');
            const data = await res.json();
            if (!res.ok || !data.transactions) throw new Error(data.error || 'Failed to load transactions');
            
            const container = $('#recent-transactions');
            if (!container) return;

            if (!data.transactions.length) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:2rem 1rem;">
                        <div class="empty-icon">📭</div>
                        <p>No transactions yet</p>
                    </div>`;
                return;
            }

            container.innerHTML = data.transactions.map(t => `
                <div class="recent-txn-item">
                    <div class="recent-txn-icon ${t.type}">
                        ${categoryEmojis[t.category] || '📦'}
                    </div>
                    <div class="recent-txn-info">
                        <span class="recent-txn-merchant">${t.description || t.category}</span>
                        <span class="recent-txn-category">${t.category}</span>
                    </div>
                    <div class="recent-txn-details">
                        <span class="recent-txn-date">${formatDate(t.date)}</span>
                        <span class="recent-txn-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${formatCurrencyFull(t.amount)}</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Failed to load recent transactions:', err);
        }
    }

    // ---- Budget Status ----
    async function loadBudgetStatus() {
        try {
            const month = getCurrentMonth();
            const res = await fetch(`/api/budgets?month=${month}`);
            const data = await res.json();
            if (!res.ok || !data.budgets) throw new Error(data.error || 'Failed to load budget status');
            
            const container = $('#budget-status');
            if (!container) return;

            if (!data.budgets.length) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:2rem 1rem;">
                        <div class="empty-icon">📋</div>
                        <p>No budgets set. <a href="/budget.html">Create one</a></p>
                    </div>`;
                return;
            }

            container.innerHTML = data.budgets.slice(0, 4).map(b => {
                const pct = Math.min(100, b.percentage);
                let color = 'var(--accent-green)';
                if (pct > 80) color = 'var(--accent-red)';
                else if (pct > 60) color = 'var(--accent-amber)';

                return `
                    <div class="budget-status-item">
                        <div class="budget-status-header">
                            <span class="budget-status-label">${categoryEmojis[b.category] || ''} ${b.category}</span>
                            <span class="budget-status-amounts">${formatCurrency(b.spent)} / ${formatCurrency(b.amount)}</span>
                        </div>
                        <div class="budget-progress-bar">
                            <div class="budget-progress-fill" style="width:${pct}%;background:${color};"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Failed to load budget status:', err);
        }
    }

    // ---- Quick Add Transaction Modal ----
    const modalOverlay = $('#transaction-modal');
    const modalTitle = $('#modal-title');
    const modalClose = $('#modal-close');
    const modalCancel = $('#modal-cancel');
    const modalSubmit = $('#modal-submit');
    const modalError = $('#modal-error');
    const transactionForm = $('#transaction-form');
    const editId = $('#edit-id');
    const txnType = $('#txn-type');
    const txnAmount = $('#txn-amount');
    const txnCategory = $('#txn-category');
    const txnDate = $('#txn-date');
    const txnDescription = $('#txn-description');
    const addTransactionBtn = $('#add-transaction-btn');

    function openAddModal() {
        editId.value = '';
        transactionForm.reset();
        txnDate.value = new Date().toISOString().split('T')[0];
        modalTitle.textContent = 'Add Transaction';
        modalSubmit.textContent = 'Add Transaction';
        modalError.classList.remove('visible');
        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    if (addTransactionBtn) addTransactionBtn.addEventListener('click', openAddModal);
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
    });

    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        modalError.classList.remove('visible');

        const body = {
            type: txnType.value,
            amount: parseFloat(txnAmount.value),
            category: txnCategory.value,
            date: txnDate.value,
            description: txnDescription.value.trim(),
        };

        if (!body.amount || body.amount <= 0) {
            modalError.textContent = 'Please enter a valid amount';
            modalError.classList.add('visible');
            return;
        }

        try {
            modalSubmit.disabled = true;
            modalSubmit.textContent = 'Adding...';

            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add transaction');

            closeModal();
            showToast('Transaction added!', 'success');
            refreshAll();
        } catch (err) {
            modalError.textContent = err.message;
            modalError.classList.add('visible');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = 'Add Transaction';
        }
    });

    // ---- Starting Balance Modal ----
    const balanceModal = $('#balance-modal');
    const balanceForm = $('#balance-form');
    const balanceModalClose = $('#balance-modal-close');
    const balanceModalCancel = $('#balance-modal-cancel');

    function closeBalanceModal() { balanceModal.classList.remove('active'); }
    if (balanceModalClose) balanceModalClose.addEventListener('click', closeBalanceModal);
    if (balanceModalCancel) balanceModalCancel.addEventListener('click', closeBalanceModal);

    if (balanceForm) {
        balanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat($('#starting-balance-input').value);
            try {
                const res = await fetch('/api/auth/balance', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ startingBalance: amount }),
                });
                if (!res.ok) throw new Error('Failed');
                closeBalanceModal();
                showToast('Starting balance updated!', 'success');
                refreshAll();
            } catch {
                showToast('Failed to update balance', 'error');
            }
        });
    }

    // ---- Refresh All Data ----
    async function refreshAll() {
        await Promise.all([
            loadSummary(),
            loadSpendingChart(),
            loadCategoryChart(),
            loadRecentTransactions(),
            loadBudgetStatus(),
        ]);
    }

    // ---- Initialize ----
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;

        await refreshAll();

        loadingOverlay.classList.add('hidden');
        setTimeout(() => loadingOverlay.remove(), 500);
    }

    init();
})();
