// ============================================
// MoneyTrack — Recurring Transactions Logic
// ============================================

(function () {
    const $ = (sel) => document.querySelector(sel);

    // Sidebar
    const sidebar = $('#sidebar');
    const hamburgerBtn = $('#hamburger-btn');
    const sidebarClose = $('#sidebar-close');
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', () => sidebar.classList.add('open'));
    if (sidebarClose) sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

    function formatCurrency(a) { return '₹' + Number(a).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    function showToast(msg, type = 'success') {
        const c = $('#toast-container'), t = document.createElement('div');
        t.className = `toast ${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }
    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const categoryEmojis = { 'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Entertainment': '🎬', 'Utilities': '⚡', 'Salary': '💼', 'Other': '📦' };
    const frequencyLabels = { 'weekly': 'Weekly', 'monthly': 'Monthly', 'yearly': 'Yearly' };

    const recurringGrid = $('#recurring-grid');
    const recurringEmpty = $('#recurring-empty');
    const addRecurringBtn = $('#add-recurring-btn');
    const recurringModal = $('#recurring-modal');
    const recurringForm = $('#recurring-form');
    const recurringModalClose = $('#recurring-modal-close');
    const recurringModalCancel = $('#recurring-modal-cancel');
    const recurringModalError = $('#recurring-modal-error');

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

    $('#logout-btn').addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/'; }
    });

    // Load recurring
    async function loadRecurring() {
        try {
            const res = await fetch('/api/recurring');
            const data = await res.json();

            if (!data.recurring.length) {
                recurringGrid.innerHTML = '';
                recurringEmpty.style.display = 'block';
                return;
            }

            recurringEmpty.style.display = 'none';
            recurringGrid.innerHTML = data.recurring.map(r => {
                const isActive = r.is_active;
                return `
                    <div class="recurring-card ${!isActive ? 'paused' : ''}">
                        <div class="recurring-header">
                            <div class="recurring-type-badge ${r.type}">${r.type}</div>
                            <div class="recurring-freq">${frequencyLabels[r.frequency] || r.frequency}</div>
                        </div>
                        <div class="recurring-details">
                            <div class="recurring-category">${categoryEmojis[r.category] || ''} ${r.category}</div>
                            <div class="recurring-amount ${r.type}">${r.type === 'expense' ? '-' : '+'}${formatCurrency(r.amount)}</div>
                            ${r.description ? `<div class="recurring-desc">${r.description}</div>` : ''}
                            <div class="recurring-next">Next: ${formatDate(r.next_date)}</div>
                        </div>
                        <div class="recurring-actions">
                            <button class="btn btn-ghost btn-sm toggle-btn" data-id="${r.id}">
                                ${isActive ? '⏸ Pause' : '▶ Resume'}
                            </button>
                            <button class="btn-icon delete-recurring-btn" data-id="${r.id}" title="Delete">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');

            // Toggle handlers
            recurringGrid.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await fetch(`/api/recurring/${btn.dataset.id}/toggle`, { method: 'PUT' });
                        showToast('Updated');
                        loadRecurring();
                    } catch { showToast('Failed', 'error'); }
                });
            });

            // Delete handlers
            recurringGrid.querySelectorAll('.delete-recurring-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this recurring transaction?')) return;
                    try {
                        await fetch(`/api/recurring/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Deleted');
                        loadRecurring();
                    } catch { showToast('Failed', 'error'); }
                });
            });
        } catch (err) {
            console.error('Load recurring error:', err);
        }
    }

    // Add modal
    addRecurringBtn.addEventListener('click', () => {
        recurringForm.reset();
        $('#rec-start-date').value = new Date().toISOString().split('T')[0];
        recurringModalError.classList.remove('visible');
        recurringModal.classList.add('active');
    });
    recurringModalClose.addEventListener('click', () => recurringModal.classList.remove('active'));
    recurringModalCancel.addEventListener('click', () => recurringModal.classList.remove('active'));
    recurringModal.addEventListener('click', e => { if (e.target === recurringModal) recurringModal.classList.remove('active'); });

    recurringForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        recurringModalError.classList.remove('visible');

        const body = {
            type: $('#rec-type').value,
            amount: parseFloat($('#rec-amount').value),
            category: $('#rec-category').value,
            frequency: $('#rec-frequency').value,
            next_date: $('#rec-start-date').value,
            description: $('#rec-description').value.trim(),
        };

        try {
            const res = await fetch('/api/recurring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            recurringModal.classList.remove('active');
            showToast('Recurring transaction created!');
            loadRecurring();
        } catch (err) {
            recurringModalError.textContent = err.message;
            recurringModalError.classList.add('visible');
        }
    });

    // Init
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;
        await loadRecurring();
        const lo = $('#loading-overlay');
        lo.classList.add('hidden');
        setTimeout(() => lo.remove(), 500);
    }
    init();
})();
