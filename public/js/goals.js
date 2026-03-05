// ============================================
// MoneyTrack — Savings Goals Logic
// ============================================

(function () {
    const $ = (sel) => document.querySelector(sel);

    // Sidebar
    const sidebar = $('#sidebar');
    const hamburgerBtn = $('#hamburger-btn');
    const sidebarClose = $('#sidebar-close');
    const sidebarOverlay = $('#sidebar-overlay');
    function openSidebar() { sidebar.classList.add('open'); if (sidebarOverlay) sidebarOverlay.classList.add('active'); }
    function closeSidebar() { sidebar.classList.remove('open'); if (sidebarOverlay) sidebarOverlay.classList.remove('active'); }
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    function formatCurrency(a) { return '₹' + Number(a).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    function showToast(msg, type = 'success') {
        const c = $('#toast-container'), t = document.createElement('div');
        t.className = `toast ${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    const goalsGrid = $('#goals-grid');
    const goalsEmpty = $('#goals-empty');
    const addGoalBtn = $('#add-goal-btn');
    const goalModal = $('#goal-modal');
    const goalForm = $('#goal-form');
    const goalModalClose = $('#goal-modal-close');
    const goalModalCancel = $('#goal-modal-cancel');
    const goalModalError = $('#goal-modal-error');
    const goalModalTitle = $('#goal-modal-title');
    const goalModalSubmit = $('#goal-modal-submit');
    const goalEditId = $('#goal-edit-id');
    const contributeModal = $('#contribute-modal');
    const contributeForm = $('#contribute-form');
    const contributeGoalId = $('#contribute-goal-id');
    const contributeGoalName = $('#contribute-goal-name');
    const contributeModalClose = $('#contribute-modal-close');
    const contributeModalCancel = $('#contribute-modal-cancel');

    let selectedIcon = '🎯';

    // Icon picker
    document.querySelectorAll('.icon-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedIcon = btn.dataset.icon;
        });
    });

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

    // Load goals
    async function loadGoals() {
        try {
            const res = await fetch('/api/goals');
            const data = await res.json();

            if (!data.goals.length) {
                goalsGrid.innerHTML = '';
                goalsEmpty.style.display = 'block';
                return;
            }

            goalsEmpty.style.display = 'none';
            goalsGrid.innerHTML = data.goals.map(g => {
                const pct = g.percentage;
                const circumference = 2 * Math.PI * 45;
                const offset = circumference - (pct / 100) * circumference;
                const deadlineText = g.daysLeft !== null
                    ? (g.daysLeft > 0 ? `${g.daysLeft} days left` : 'Deadline passed!')
                    : 'No deadline';
                const isComplete = pct >= 100;

                return `
                    <div class="goal-card ${isComplete ? 'completed' : ''}">
                        <div class="goal-progress-ring">
                            <svg width="110" height="110" viewBox="0 0 110 110">
                                <circle cx="55" cy="55" r="45" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
                                <circle cx="55" cy="55" r="45" fill="none"
                                    stroke="${isComplete ? 'var(--accent-green)' : g.color || 'var(--accent-blue)'}"
                                    stroke-width="8"
                                    stroke-dasharray="${circumference}"
                                    stroke-dashoffset="${offset}"
                                    stroke-linecap="round"
                                    transform="rotate(-90 55 55)"
                                    style="transition: stroke-dashoffset 1s ease;"/>
                            </svg>
                            <div class="goal-ring-text">
                                <span class="goal-icon">${g.icon || '🎯'}</span>
                                <span class="goal-pct">${pct}%</span>
                            </div>
                        </div>
                        <div class="goal-info">
                            <h3 class="goal-name">${g.name}</h3>
                            <div class="goal-amounts">
                                <span class="goal-current">${formatCurrency(g.current_amount)}</span>
                                <span class="goal-sep">/</span>
                                <span class="goal-target">${formatCurrency(g.target_amount)}</span>
                            </div>
                            <div class="goal-deadline">${deadlineText}</div>
                            <div class="goal-actions">
                                ${!isComplete ? `<button class="btn btn-primary btn-sm contribute-btn" data-id="${g.id}" data-name="${g.name}">+ Contribute</button>` : '<span class="goal-complete-badge">✅ Goal Reached!</span>'}
                                <button class="btn-icon delete-goal-btn" data-id="${g.id}" title="Delete">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Event handlers
            goalsGrid.querySelectorAll('.contribute-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    contributeGoalId.value = btn.dataset.id;
                    contributeGoalName.textContent = `Contributing to: ${btn.dataset.name}`;
                    $('#contribute-amount').value = '';
                    contributeModal.classList.add('active');
                });
            });

            goalsGrid.querySelectorAll('.delete-goal-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this savings goal?')) return;
                    try {
                        await fetch(`/api/goals/${btn.dataset.id}`, { method: 'DELETE' });
                        showToast('Goal deleted');
                        loadGoals();
                    } catch { showToast('Delete failed', 'error'); }
                });
            });
        } catch (err) {
            console.error('Load goals error:', err);
        }
    }

    // Add goal modal
    addGoalBtn.addEventListener('click', () => {
        goalEditId.value = '';
        goalForm.reset();
        goalModalTitle.textContent = 'New Savings Goal';
        goalModalSubmit.textContent = 'Create Goal';
        goalModalError.classList.remove('visible');
        selectedIcon = '🎯';
        document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('active'));
        document.querySelector('.icon-option[data-icon="🎯"]').classList.add('active');
        goalModal.classList.add('active');
    });

    goalModalClose.addEventListener('click', () => goalModal.classList.remove('active'));
    goalModalCancel.addEventListener('click', () => goalModal.classList.remove('active'));
    goalModal.addEventListener('click', e => { if (e.target === goalModal) goalModal.classList.remove('active'); });

    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        goalModalError.classList.remove('visible');

        const body = {
            name: $('#goal-name').value.trim(),
            target_amount: parseFloat($('#goal-target').value),
            deadline: $('#goal-deadline').value || null,
            icon: selectedIcon,
        };

        try {
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            goalModal.classList.remove('active');
            showToast('Goal created!');
            loadGoals();
        } catch (err) {
            goalModalError.textContent = err.message;
            goalModalError.classList.add('visible');
        }
    });

    // Contribute modal
    contributeModalClose.addEventListener('click', () => contributeModal.classList.remove('active'));
    contributeModalCancel.addEventListener('click', () => contributeModal.classList.remove('active'));
    contributeModal.addEventListener('click', e => { if (e.target === contributeModal) contributeModal.classList.remove('active'); });

    contributeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = contributeGoalId.value;
        const amount = parseFloat($('#contribute-amount').value);

        try {
            const res = await fetch(`/api/goals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contribute: amount }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            contributeModal.classList.remove('active');
            showToast(`₹${amount.toLocaleString()} contributed!`);
            loadGoals();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Init
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;
        await loadGoals();
        const lo = $('#loading-overlay');
        lo.classList.add('hidden');
        setTimeout(() => lo.remove(), 500);
    }
    init();
})();
