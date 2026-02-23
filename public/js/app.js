// ============================================
// MoneyTrack — Dashboard Application Logic
// ============================================

(function () {
    // ---- State ----
    let currentPage = 1;
    const pageLimit = 10;
    let sortOrder = 'desc';
    let categoryChart = null;
    let monthlyChart = null;

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const loadingOverlay = $('#loading-overlay');
    const userEmail = $('#user-email');
    const logoutBtn = $('#logout-btn');
    const totalIncome = $('#total-income');
    const totalExpenses = $('#total-expenses');
    const currentBalance = $('#current-balance');
    const transactionsBody = $('#transactions-body');
    const paginationEl = $('#pagination');
    const filterCategory = $('#filter-category');
    const filterType = $('#filter-type');
    const sortDateBtn = $('#sort-date');
    const addTransactionBtn = $('#add-transaction-btn');
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

    // ---- Helpers ----
    function formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
        return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }

    const categoryEmojis = {
        'Food': '🍔',
        'Transport': '🚗',
        'Rent': '🏠',
        'Entertainment': '🎬',
        'Utilities': '⚡',
        'Salary': '💼',
        'Other': '📦',
    };

    const categoryColors = {
        'Food': '#f97316',
        'Transport': '#3b82f6',
        'Rent': '#a855f7',
        'Entertainment': '#ec4899',
        'Utilities': '#eab308',
        'Salary': '#22c55e',
        'Other': '#6b7280',
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
            if (!res.ok) {
                window.location.href = '/';
                return false;
            }
            const data = await res.json();
            userEmail.textContent = data.user.email;
            return true;
        } catch {
            window.location.href = '/';
            return false;
        }
    }

    // ---- Logout ----
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            window.location.href = '/';
        }
    });

    // ---- Dashboard Summary ----
    async function loadSummary() {
        try {
            const month = getCurrentMonth();
            const res = await fetch(`/api/dashboard/summary?month=${month}`);
            const data = await res.json();

            totalIncome.textContent = formatCurrency(data.totalIncome);
            totalExpenses.textContent = formatCurrency(data.totalExpenses);
            currentBalance.textContent = formatCurrency(data.balance);

            // Add color class based on balance positive/negative
            currentBalance.style.color = data.balance >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)';
        } catch (err) {
            console.error('Failed to load summary:', err);
        }
    }

    // ---- Category Chart ----
    async function loadCategoryChart() {
        try {
            const month = getCurrentMonth();
            const res = await fetch(`/api/dashboard/categories?month=${month}`);
            const data = await res.json();

            const labels = data.categories.map(c => c.category);
            const values = data.categories.map(c => c.total);
            const colors = labels.map(l => categoryColors[l] || '#6b7280');

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
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#9898a6',
                                font: { family: 'Inter', size: 12 },
                                padding: 12,
                                usePointStyle: true,
                                pointStyleWidth: 10,
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return {
                                            text: `${categoryEmojis[label] || ''} ${label} (${pct}%)`,
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
                                label: (ctx) => ` ${formatCurrency(ctx.parsed)}`,
                            },
                        },
                    },
                },
            });
        } catch (err) {
            console.error('Failed to load category chart:', err);
        }
    }

    // ---- Monthly Chart ----
    async function loadMonthlyChart() {
        try {
            const res = await fetch('/api/dashboard/monthly?months=6');
            const data = await res.json();

            const labels = data.monthly.map(m => getMonthLabel(m.month));
            const incomeData = data.monthly.map(m => m.income);
            const expenseData = data.monthly.map(m => m.expense);

            const ctx = document.getElementById('monthly-chart').getContext('2d');

            if (monthlyChart) monthlyChart.destroy();

            if (labels.length === 0) {
                ctx.font = '14px Inter';
                ctx.fillStyle = '#5e5e6e';
                ctx.textAlign = 'center';
                ctx.fillText('No data yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }

            monthlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Income',
                            data: incomeData,
                            backgroundColor: 'rgba(52, 211, 153, 0.7)',
                            borderColor: '#34d399',
                            borderWidth: 1,
                            borderRadius: 6,
                            borderSkipped: false,
                        },
                        {
                            label: 'Expense',
                            data: expenseData,
                            backgroundColor: 'rgba(248, 113, 113, 0.7)',
                            borderColor: '#f87171',
                            borderWidth: 1,
                            borderRadius: 6,
                            borderSkipped: false,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#9898a6', font: { family: 'Inter', size: 11 } },
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: {
                                color: '#9898a6',
                                font: { family: 'Inter', size: 11 },
                                callback: (v) => '₹' + (v / 1000).toFixed(0) + 'k',
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
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
                            },
                        },
                    },
                },
            });
        } catch (err) {
            console.error('Failed to load monthly chart:', err);
        }
    }

    // ---- Transactions ----
    async function loadTransactions() {
        try {
            const category = filterCategory.value;
            const type = filterType.value;
            let url = `/api/transactions?page=${currentPage}&limit=${pageLimit}&sort=${sortOrder}`;
            if (category) url += `&category=${encodeURIComponent(category)}`;
            if (type) url += `&type=${encodeURIComponent(type)}`;

            const res = await fetch(url);
            const data = await res.json();

            renderTransactions(data.transactions);
            renderPagination(data.pagination);
        } catch (err) {
            console.error('Failed to load transactions:', err);
        }
    }

    function renderTransactions(transactions) {
        if (!transactions.length) {
            transactionsBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="empty-icon">📭</div>
                            <p>No transactions found. Click "+ Add Transaction" to get started!</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        transactionsBody.innerHTML = transactions.map(t => `
            <tr data-id="${t.id}">
                <td>${formatDate(t.date)}</td>
                <td><span class="type-badge ${t.type}">${t.type}</span></td>
                <td><span class="category-tag">${categoryEmojis[t.category] || ''} ${t.category}</span></td>
                <td><span class="amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}</span></td>
                <td><span class="description-text" title="${t.description || ''}">${t.description || '—'}</span></td>
                <td>
                    <div class="actions">
                        <button class="btn-icon edit-btn" title="Edit" data-id="${t.id}">✏️</button>
                        <button class="btn-icon delete-btn" title="Delete" data-id="${t.id}">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Attach edit/delete handlers
        transactionsBody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(transactions.find(t => t.id == btn.dataset.id)));
        });

        transactionsBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
        });
    }

    function renderPagination(pg) {
        if (pg.totalPages <= 1) {
            paginationEl.innerHTML = `<span class="page-info">${pg.total} transaction${pg.total !== 1 ? 's' : ''}</span>`;
            return;
        }

        let html = '';
        html += `<button ${pg.page <= 1 ? 'disabled' : ''} data-page="${pg.page - 1}">‹ Prev</button>`;

        for (let i = 1; i <= pg.totalPages; i++) {
            if (pg.totalPages > 7) {
                if (i === 1 || i === pg.totalPages || (i >= pg.page - 1 && i <= pg.page + 1)) {
                    html += `<button class="${i === pg.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === pg.page - 2 || i === pg.page + 2) {
                    html += `<span class="page-info">...</span>`;
                }
            } else {
                html += `<button class="${i === pg.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
        }

        html += `<button ${pg.page >= pg.totalPages ? 'disabled' : ''} data-page="${pg.page + 1}">Next ›</button>`;
        html += `<span class="page-info">${pg.total} total</span>`;

        paginationEl.innerHTML = html;

        paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                loadTransactions();
            });
        });
    }

    // ---- Filters & Sorting ----
    filterCategory.addEventListener('change', () => { currentPage = 1; loadTransactions(); });
    filterType.addEventListener('change', () => { currentPage = 1; loadTransactions(); });

    sortDateBtn.addEventListener('click', () => {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        sortDateBtn.textContent = sortOrder === 'desc' ? 'Date ↓' : 'Date ↑';
        loadTransactions();
    });

    // ---- Modal ----
    function openAddModal() {
        editId.value = '';
        transactionForm.reset();
        txnDate.value = new Date().toISOString().split('T')[0];
        modalTitle.textContent = 'Add Transaction';
        modalSubmit.textContent = 'Add Transaction';
        modalError.classList.remove('visible');
        modalOverlay.classList.add('active');
    }

    function openEditModal(txn) {
        editId.value = txn.id;
        txnType.value = txn.type;
        txnAmount.value = txn.amount;
        txnCategory.value = txn.category;
        txnDate.value = txn.date;
        txnDescription.value = txn.description || '';
        modalTitle.textContent = 'Edit Transaction';
        modalSubmit.textContent = 'Save Changes';
        modalError.classList.remove('visible');
        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    addTransactionBtn.addEventListener('click', openAddModal);
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // ---- Submit Transaction ----
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

        const isEdit = !!editId.value;
        const url = isEdit ? `/api/transactions/${editId.value}` : '/api/transactions';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            modalSubmit.disabled = true;
            modalSubmit.textContent = isEdit ? 'Saving...' : 'Adding...';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save transaction');
            }

            closeModal();
            showToast(isEdit ? 'Transaction updated!' : 'Transaction added!', 'success');
            refreshAll();
        } catch (err) {
            modalError.textContent = err.message;
            modalError.classList.add('visible');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = isEdit ? 'Save Changes' : 'Add Transaction';
        }
    });

    // ---- Delete Transaction ----
    async function deleteTransaction(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) return;

        try {
            const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Delete failed');
            }

            showToast('Transaction deleted', 'success');
            refreshAll();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // ---- Refresh All Data ----
    async function refreshAll() {
        await Promise.all([
            loadSummary(),
            loadCategoryChart(),
            loadMonthlyChart(),
            loadTransactions(),
        ]);
    }

    // ---- Initialize ----
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;

        await refreshAll();

        // Hide loading overlay
        loadingOverlay.classList.add('hidden');
        setTimeout(() => loadingOverlay.remove(), 500);
    }

    init();
})();
