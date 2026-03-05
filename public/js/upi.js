// ============================================
// MoneyTrack — UPI Pay & Track Logic
// ============================================

(function () {
    const $ = (sel) => document.querySelector(sel);
    const loadingOverlay = $('#loading-overlay');
    const userEmail = $('#user-email');
    const userAvatar = $('#user-avatar');
    const logoutBtn = $('#logout-btn');
    const sidebar = $('#sidebar');
    const hamburgerBtn = $('#hamburger-btn');
    const sidebarClose = $('#sidebar-close');
    const sidebarOverlay = $('#sidebar-overlay');

    // ---- Sidebar ----
    function openSidebar() { sidebar.classList.add('open'); if (sidebarOverlay) sidebarOverlay.classList.add('active'); }
    function closeSidebar() { sidebar.classList.remove('open'); if (sidebarOverlay) sidebarOverlay.classList.remove('active'); }
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // ---- Helpers ----
    function formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function showToast(message, type = 'success') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // ---- Auth ----
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) { window.location.href = '/'; return false; }
            const data = await res.json();
            if (userEmail) userEmail.textContent = data.user.email;
            if (userAvatar) userAvatar.textContent = data.user.email.charAt(0).toUpperCase();
            return true;
        } catch {
            window.location.href = '/';
            return false;
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/'; }
        });
    }

    // ---- UPI Form ----
    const upiForm = $('#upi-form');
    const upiAmountInput = $('#upi-amount');
    const upiPayeeId = $('#upi-payee-id');
    const upiPayeeName = $('#upi-payee-name');
    const upiCategory = $('#upi-category');
    const upiDate = $('#upi-date');
    const upiNote = $('#upi-note');
    const upiPayBtn = $('#upi-pay-btn');
    const upiAppPills = document.querySelectorAll('.upi-app-pill');

    // Set today's date
    if (upiDate) upiDate.value = new Date().toISOString().split('T')[0];

    // App pill selection
    let selectedApp = 'default';
    upiAppPills.forEach(pill => {
        pill.addEventListener('click', () => {
            upiAppPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedApp = pill.dataset.app;
        });
    });

    // Build UPI deep link
    function buildUpiUrl(pa, pn, am, tn) {
        const baseParams = `pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn || `Payment to ${pn}`)}`;

        // App-specific intents (Android intent URLs to target specific apps)
        const appIntents = {
            gpay: `gpay://upi/pay?${baseParams}`,
            phonepe: `phonepe://pay?${baseParams}`,
            paytm: `paytmmp://pay?${baseParams}`,
            default: `upi://pay?${baseParams}`,
        };
        return appIntents[selectedApp] || appIntents.default;
    }

    // Save pending transaction to sessionStorage before opening UPI app
    const PENDING_KEY = 'upi_pending_txn';

    function savePendingTransaction(data) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
    }

    function getPendingTransaction() {
        const raw = sessionStorage.getItem(PENDING_KEY);
        return raw ? JSON.parse(raw) : null;
    }

    function clearPendingTransaction() {
        sessionStorage.removeItem(PENDING_KEY);
    }

    // ---- UPI Pay Submit ----
    if (upiForm) {
        upiForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(upiAmountInput.value);
            const payeeId = upiPayeeId.value.trim();
            const payeeName = upiPayeeName.value.trim();
            const category = upiCategory.value;
            const date = upiDate.value;
            const note = upiNote.value.trim();

            if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');
            if (!payeeId) return showToast('Enter payee UPI ID', 'error');
            if (!payeeName) return showToast('Enter payee name', 'error');

            // Store pending intent
            const pending = { amount, payeeId, payeeName, category, date, note: note || payeeName };
            savePendingTransaction(pending);

            const upiUrl = buildUpiUrl(payeeId, payeeName, amount, note || `Payment to ${payeeName}`);

            // Open UPI app
            upiPayBtn.textContent = '🚀 Opening UPI App...';
            upiPayBtn.disabled = true;

            // Attempt to open the UPI URL
            const link = document.createElement('a');
            link.href = upiUrl;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Re-enable button after a short delay
            setTimeout(() => {
                upiPayBtn.innerHTML = '<span class="btn-upi-icon">⚡</span> Pay via UPI';
                upiPayBtn.disabled = false;
            }, 2000);
        });
    }

    // ---- Detect Return from UPI App ----
    // When user switches back to our page, check for pending transaction
    let visibilityCheckDone = false;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !visibilityCheckDone) {
            const pending = getPendingTransaction();
            if (pending) {
                visibilityCheckDone = true;
                // Small delay so the page fully resumes
                setTimeout(() => showConfirmModal(pending), 600);
            }
        }
        if (document.visibilityState === 'hidden') {
            visibilityCheckDone = false; // reset so we can re-trigger if needed
        }
    });

    // Also check on page focus (some browsers use this instead)
    window.addEventListener('focus', () => {
        const pending = getPendingTransaction();
        if (pending && !document.getElementById('upi-confirm-modal')?.classList.contains('active')) {
            setTimeout(() => showConfirmModal(pending), 600);
        }
    });

    // ---- Confirmation Modal ----
    const confirmModal = $('#upi-confirm-modal');
    const confirmDetails = $('#upi-confirm-details');
    const confirmYes = $('#upi-confirm-yes');
    const confirmNo = $('#upi-confirm-no');
    const confirmError = $('#upi-confirm-error');

    function showConfirmModal(pending) {
        if (!confirmModal) return;

        confirmDetails.innerHTML = `
            <div class="upi-confirm-row">
                <span class="upi-confirm-label">Amount</span>
                <span class="upi-confirm-value amount-value">${formatCurrency(pending.amount)}</span>
            </div>
            <div class="upi-confirm-row">
                <span class="upi-confirm-label">To</span>
                <span class="upi-confirm-value">${pending.payeeName}</span>
            </div>
            <div class="upi-confirm-row">
                <span class="upi-confirm-label">UPI ID</span>
                <span class="upi-confirm-value upi-id-small">${pending.payeeId}</span>
            </div>
            <div class="upi-confirm-row">
                <span class="upi-confirm-label">Category</span>
                <span class="upi-confirm-value">${pending.category}</span>
            </div>
            <div class="upi-confirm-row">
                <span class="upi-confirm-label">Date</span>
                <span class="upi-confirm-value">${formatDate(pending.date)}</span>
            </div>
        `;

        if (confirmError) confirmError.classList.remove('visible');
        confirmModal.classList.add('active');
    }

    if (confirmNo) {
        confirmNo.addEventListener('click', () => {
            confirmModal.classList.remove('active');
            clearPendingTransaction();
            showToast('Payment not logged.', 'error');
        });
    }

    if (confirmYes) {
        confirmYes.addEventListener('click', async () => {
            const pending = getPendingTransaction();
            if (!pending) { confirmModal.classList.remove('active'); return; }

            confirmYes.disabled = true;
            confirmYes.textContent = 'Saving...';

            try {
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'expense',
                        amount: pending.amount,
                        category: pending.category,
                        date: pending.date,
                        description: pending.note || `UPI to ${pending.payeeName}`,
                    }),
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to save transaction');

                clearPendingTransaction();
                confirmModal.classList.remove('active');
                showToast(`✅ ₹${pending.amount} to ${pending.payeeName} logged!`, 'success');

                // Reset form
                upiForm.reset();
                if (upiDate) upiDate.value = new Date().toISOString().split('T')[0];

                // Refresh recent list
                loadRecentUpi();
            } catch (err) {
                if (confirmError) {
                    confirmError.textContent = err.message;
                    confirmError.classList.add('visible');
                }
            } finally {
                confirmYes.disabled = false;
                confirmYes.textContent = '✅ Yes, Log Transaction';
            }
        });
    }

    // Close modal on backdrop click
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.classList.remove('active');
                clearPendingTransaction();
            }
        });
    }

    // ---- Recent UPI Transactions ----
    async function loadRecentUpi() {
        try {
            const res = await fetch('/api/transactions?limit=5&sort=desc');
            const data = await res.json();
            const list = $('#upi-recent-list');
            if (!list) return;

            const txns = (data.transactions || []).filter(t => t.type === 'expense');
            if (!txns.length) {
                list.innerHTML = `<div class="empty-state" style="padding:2rem;"><div class="empty-icon">📭</div><p>No UPI transactions yet</p></div>`;
                return;
            }

            list.innerHTML = txns.map(t => `
                <div class="upi-recent-item">
                    <div class="upi-recent-icon">💸</div>
                    <div class="upi-recent-body">
                        <span class="upi-recent-desc">${t.description || t.category}</span>
                        <span class="upi-recent-date">${formatDate(t.date)} · ${t.category}</span>
                    </div>
                    <span class="upi-recent-amount">-${formatCurrency(t.amount)}</span>
                </div>
            `).join('');
        } catch { /* ignore */ }
    }

    // ---- Init ----
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;
        await loadRecentUpi();

        // Check if there's a lingering pending transaction on load
        const pending = getPendingTransaction();
        if (pending) {
            setTimeout(() => showConfirmModal(pending), 1000);
        }

        loadingOverlay.classList.add('hidden');
        setTimeout(() => loadingOverlay.remove(), 500);
    }

    init();
})();
