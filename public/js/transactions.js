// ============================================
// MoneyTrack — Transactions Ledger Logic
// ============================================

(function () {
    // ---- State ----
    let currentPage = 1;
    const pageLimit = 10;
    let sortOrder = 'desc';
    let searchTimeout = null;

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const loadingOverlay = $('#loading-overlay');
    const userEmail = $('#user-email');
    const userAvatar = $('#user-avatar');
    const logoutBtn = $('#logout-btn');
    const transactionsBody = $('#transactions-body');
    const paginationEl = $('#pagination');
    const filterCategory = $('#filter-category');
    const filterType = $('#filter-type');
    const searchInput = $('#search-input');
    const dateFrom = $('#date-from');
    const dateTo = $('#date-to');
    const sortDateBtn = $('#sort-date');
    const addTransactionBtn = $('#add-transaction-btn');
    const exportCsvBtn = $('#export-csv-btn');
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
    const txnCountSubtitle = $('#txn-count-subtitle');

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
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const categoryEmojis = {
        'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Entertainment': '🎬',
        'Utilities': '⚡', 'Salary': '💼', 'Other': '📦',
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

    // ---- Load Transactions ----
    async function loadTransactions() {
        try {
            const category = filterCategory.value;
            const type = filterType.value;
            const search = searchInput ? searchInput.value : '';
            const dfrom = dateFrom ? dateFrom.value : '';
            const dto = dateTo ? dateTo.value : '';
            let url = `/api/transactions?page=${currentPage}&limit=${pageLimit}&sort=${sortOrder}`;
            if (category) url += `&category=${encodeURIComponent(category)}`;
            if (type) url += `&type=${encodeURIComponent(type)}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (dfrom) url += `&dateFrom=${dfrom}`;
            if (dto) url += `&dateTo=${dto}`;

            const res = await fetch(url);
            const data = await res.json();

            renderTransactions(data.transactions);
            renderPagination(data.pagination);

            // Update subtitle
            if (txnCountSubtitle) {
                txnCountSubtitle.textContent = `Reviewing ${data.pagination.total.toLocaleString()} transaction${data.pagination.total !== 1 ? 's' : ''}`;
            }
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
                            <h3>No transactions found</h3>
                            <p>Click "+ Add Transaction" to get started!</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        transactionsBody.innerHTML = transactions.map(t => `
            <tr data-id="${t.id}">
                <td class="txn-date-cell">${formatDate(t.date)}</td>
                <td>
                    <div class="txn-description-cell">
                        <span class="txn-desc-primary">${t.description || t.category}</span>
                        ${t.description ? `<span class="txn-desc-secondary">${t.category}</span>` : ''}
                    </div>
                </td>
                <td><span class="category-tag">${categoryEmojis[t.category] || ''} ${t.category}</span></td>
                <td><span class="type-badge ${t.type}">${t.type}</span></td>
                <td class="text-right"><span class="amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}</span></td>
                <td>
                    <div class="actions">
                        <button class="btn-icon edit-btn" title="Edit" data-id="${t.id}">✏️</button>
                        <button class="btn-icon delete-btn" title="Delete" data-id="${t.id}">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        transactionsBody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(transactions.find(t => t.id == btn.dataset.id)));
        });

        transactionsBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
        });
    }

    function renderPagination(pg) {
        if (pg.totalPages <= 1) {
            paginationEl.innerHTML = `<span class="page-info">Showing 1 – ${pg.total} of ${pg.total} transactions</span>`;
            return;
        }

        const start = (pg.page - 1) * pageLimit + 1;
        const end = Math.min(pg.page * pageLimit, pg.total);

        let html = `<span class="page-info">Showing ${start} – ${end} of ${pg.total.toLocaleString()} transactions</span>`;
        html += `<div class="pagination-buttons">`;
        html += `<button ${pg.page <= 1 ? 'disabled' : ''} data-page="${pg.page - 1}">‹</button>`;

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

        html += `<button ${pg.page >= pg.totalPages ? 'disabled' : ''} data-page="${pg.page + 1}">›</button>`;
        html += `</div>`;

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

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { currentPage = 1; loadTransactions(); }, 300);
        });
    }

    if (dateFrom) dateFrom.addEventListener('change', () => { currentPage = 1; loadTransactions(); });
    if (dateTo) dateTo.addEventListener('change', () => { currentPage = 1; loadTransactions(); });

    sortDateBtn.addEventListener('click', () => {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        sortDateBtn.textContent = sortOrder === 'desc' ? 'Date ↓' : 'Date ↑';
        loadTransactions();
    });

    // ---- CSV Export ----
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            window.location.href = '/api/transactions/export/csv';
        });
    }

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
            loadTransactions();
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
            loadTransactions();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // ---- CSV Import ----
    const importBtn = $('#import-csv-btn');
    const importModal = $('#import-modal');
    const importModalClose = $('#import-modal-close');
    const importModalCancel = $('#import-modal-cancel');
    const importSubmit = $('#import-submit');
    const importDropZone = $('#import-drop-zone');
    const csvFileInput = $('#csv-file-input');
    const importFileInfo = $('#import-file-info');
    const importFileName = $('#import-file-name');
    const importFileRemove = $('#import-file-remove');
    const importError = $('#import-error');
    const importSuccess = $('#import-success');

    let pendingCsvData = null;

    function openImportModal() {
        pendingCsvData = null;
        if (csvFileInput) csvFileInput.value = '';
        importFileInfo.style.display = 'none';
        importDropZone.style.display = '';
        importError.classList.remove('visible');
        importSuccess.style.display = 'none';
        importSubmit.disabled = true;
        importSubmit.textContent = 'Import';
        importModal.classList.add('active');
    }

    function closeImportModal() {
        importModal.classList.remove('active');
    }

    if (importBtn) importBtn.addEventListener('click', openImportModal);
    if (importModalClose) importModalClose.addEventListener('click', closeImportModal);
    if (importModalCancel) importModalCancel.addEventListener('click', closeImportModal);
    if (importModal) {
        importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });
    }

    function handleCsvFile(file) {
        if (!file) return;
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            importError.textContent = 'Please upload a .csv file';
            importError.classList.add('visible');
            return;
        }
        importError.classList.remove('visible');
        importSuccess.style.display = 'none';

        const reader = new FileReader();
        reader.onload = (e) => {
            pendingCsvData = e.target.result;
            importFileName.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            importFileInfo.style.display = 'flex';
            importDropZone.style.display = 'none';
            importSubmit.disabled = false;
        };
        reader.readAsText(file);
    }

    if (csvFileInput) {
        csvFileInput.addEventListener('change', () => handleCsvFile(csvFileInput.files[0]));
    }

    if (importFileRemove) {
        importFileRemove.addEventListener('click', () => {
            pendingCsvData = null;
            csvFileInput.value = '';
            importFileInfo.style.display = 'none';
            importDropZone.style.display = '';
            importSubmit.disabled = true;
        });
    }

    // Drag & drop
    if (importDropZone) {
        importDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            importDropZone.classList.add('dragging');
        });
        importDropZone.addEventListener('dragleave', () => {
            importDropZone.classList.remove('dragging');
        });
        importDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            importDropZone.classList.remove('dragging');
            if (e.dataTransfer.files.length) handleCsvFile(e.dataTransfer.files[0]);
        });
    }

    // Submit import
    if (importSubmit) {
        importSubmit.addEventListener('click', async () => {
            if (!pendingCsvData) return;

            importError.classList.remove('visible');
            importSuccess.style.display = 'none';
            importSubmit.disabled = true;
            importSubmit.textContent = 'Importing...';

            try {
                const res = await fetch('/api/transactions/import/csv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csvData: pendingCsvData }),
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.error || 'Import failed');

                importSuccess.textContent = `✅ ${data.message}`;
                importSuccess.style.display = 'block';
                showToast(data.message, 'success');
                loadTransactions();

                // Reset after success
                setTimeout(() => closeImportModal(), 1500);
            } catch (err) {
                importError.textContent = err.message;
                importError.classList.add('visible');
            } finally {
                importSubmit.disabled = false;
                importSubmit.textContent = 'Import';
            }
        });
    }

    // ---- Initialize ----
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;

        await loadTransactions();

        loadingOverlay.classList.add('hidden');
        setTimeout(() => loadingOverlay.remove(), 500);
    }

    init();
})();
