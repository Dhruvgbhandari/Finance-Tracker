// ============================================
// MoneyTrack — Budget Manager Logic
// ============================================

(function () {
    const $ = (sel) => document.querySelector(sel);

    // ---- Sidebar ----
    const sidebar = $('#sidebar');
    const hamburgerBtn = $('#hamburger-btn');
    const sidebarClose = $('#sidebar-close');
    const sidebarOverlay = $('#sidebar-overlay');
    function openSidebar() { sidebar.classList.add('open'); if (sidebarOverlay) sidebarOverlay.classList.add('active'); }
    function closeSidebar() { sidebar.classList.remove('open'); if (sidebarOverlay) sidebarOverlay.classList.remove('active'); }
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // Helpers
    function formatCurrency(a) { return '₹' + Number(a).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    function showToast(msg, type = 'success') {
        const c = $('#toast-container'), t = document.createElement('div');
        t.className = `toast ${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    const categoryEmojis = { 'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Entertainment': '🎬', 'Utilities': '⚡', 'Salary': '💼', 'Other': '📦' };
    const categoryColors = { 'Food': '#f97316', 'Transport': '#3b82f6', 'Rent': '#a855f7', 'Entertainment': '#ec4899', 'Utilities': '#eab308', 'Salary': '#22c55e', 'Other': '#6b7280' };

    const monthPicker = $('#budget-month');
    const budgetGrid = $('#budget-grid');
    const budgetEmpty = $('#budget-empty');
    const addBudgetBtn = $('#add-budget-btn');
    const budgetModal = $('#budget-modal');
    const budgetForm = $('#budget-form');
    const budgetModalClose = $('#budget-modal-close');
    const budgetModalCancel = $('#budget-modal-cancel');
    const budgetModalError = $('#budget-modal-error');

    function getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    if (monthPicker) monthPicker.value = getCurrentMonth();

    // Auth
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) { window.location.href = '/'; return false; }
            const data = await res.json();
            const ue = $('#user-email'), ua = $('#user-avatar');
            if (ue) ue.textContent = data.user.email;
            if (ua) ua.textContent = data.user.email.charAt(0).toUpperCase();
            return true;
        } catch { window.location.href = '/'; return false; }
    }

    // Logout
    $('#logout-btn').addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/'; }
    });

    // Load budgets
    async function loadBudgets() {
        try {
            const month = monthPicker ? monthPicker.value : getCurrentMonth();
            const res = await fetch(`/api/budgets?month=${month}`);
            const data = await res.json();

            $('#total-budgeted').textContent = formatCurrency(data.totalBudget);
            $('#total-spent').textContent = formatCurrency(data.totalSpent);
            $('#total-remaining').textContent = formatCurrency(Math.max(0, data.totalBudget - data.totalSpent));

            if (!data.budgets.length) {
                budgetGrid.innerHTML = '';
                budgetEmpty.style.display = 'block';
                return;
            }

            budgetEmpty.style.display = 'none';
            budgetGrid.innerHTML = data.budgets.map(b => {
                const pct = b.percentage;
                const status = pct > 90 ? 'danger' : pct > 70 ? 'warning' : 'safe';
                const barColor = status === 'danger' ? 'var(--accent-red)' : status === 'warning' ? 'var(--accent-amber)' : 'var(--accent-green)';
                return `
                    <div class="budget-card">
                        <div class="budget-card-header">
                            <span class="budget-category">${categoryEmojis[b.category] || ''} ${b.category}</span>
                            <button class="btn-icon delete-budget-btn" data-id="${b.id}" title="Delete">🗑️</button>
                        </div>
                        <div class="budget-amounts">
                            <span class="budget-spent" style="color:${barColor}">${formatCurrency(b.spent)}</span>
                            <span class="budget-limit">of ${formatCurrency(b.amount)}</span>
                        </div>
                        <div class="budget-progress-bar">
                            <div class="budget-progress-fill" style="width:${Math.min(100, pct)}%;background:${barColor};"></div>
                        </div>
                        <div class="budget-pct ${status}">${pct}% used</div>
                    </div>
                `;
            }).join('');

            // Delete handlers
            budgetGrid.querySelectorAll('.delete-budget-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this budget?')) return;
                    try {
                        await fetch(`/api/budgets/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Budget deleted');
                        loadBudgets();
                    } catch { showToast('Failed to delete', 'error'); }
                });
            });
        } catch (err) {
            console.error('Load budgets error:', err);
        }
    }

    // Add budget modal
    addBudgetBtn.addEventListener('click', () => {
        budgetForm.reset();
        budgetModalError.classList.remove('visible');
        budgetModal.classList.add('active');
    });
    budgetModalClose.addEventListener('click', () => budgetModal.classList.remove('active'));
    budgetModalCancel.addEventListener('click', () => budgetModal.classList.remove('active'));
    budgetModal.addEventListener('click', e => { if (e.target === budgetModal) budgetModal.classList.remove('active'); });

    budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        budgetModalError.classList.remove('visible');
        const month = monthPicker ? monthPicker.value : getCurrentMonth();
        const body = {
            category: $('#budget-category').value,
            amount: parseFloat($('#budget-amount').value),
            month,
        };

        try {
            const res = await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            budgetModal.classList.remove('active');
            showToast('Budget saved!');
            loadBudgets();
        } catch (err) {
            budgetModalError.textContent = err.message;
            budgetModalError.classList.add('visible');
        }
    });

    if (monthPicker) monthPicker.addEventListener('change', loadBudgets);

    // Init
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;
        await loadBudgets();
        const lo = $('#loading-overlay');
        lo.classList.add('hidden');
        setTimeout(() => lo.remove(), 500);
    }
    init();
})();
