// ============================================
// MoneyTrack — Analytics Logic
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

    let networthChart = null;

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

    // Net worth chart
    async function loadNetworthChart() {
        try {
            const res = await fetch('/api/analytics/networth?months=12');
            const data = await res.json();

            const ctx = document.getElementById('networth-chart').getContext('2d');
            if (networthChart) networthChart.destroy();

            if (!data.networth.length) {
                ctx.font = '14px Inter';
                ctx.fillStyle = '#5e5e6e';
                ctx.textAlign = 'center';
                ctx.fillText('Add transactions to see your net worth trend', ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }

            const labels = data.networth.map(n => {
                const [y, m] = n.month.split('-');
                return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
            });
            const values = data.networth.map(n => n.value);

            networthChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Net Worth',
                        data: values,
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#60a5fa',
                        pointBorderColor: '#12121a',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    }],
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
                                callback: v => '₹' + (v / 1000).toFixed(0) + 'k',
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#9898a6', font: { family: 'Inter', size: 12 }, usePointStyle: true },
                        },
                        tooltip: {
                            backgroundColor: '#1a1a2e',
                            titleColor: '#f0f0f5',
                            bodyColor: '#9898a6',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: { label: ctx => ` Net Worth: ${formatCurrency(ctx.parsed.y)}` },
                        },
                    },
                },
            });
        } catch (err) {
            console.error('Load networth chart error:', err);
        }
    }

    // Heatmap
    async function loadHeatmap(year) {
        try {
            const res = await fetch(`/api/analytics/heatmap?year=${year}`);
            const data = await res.json();

            const container = $('#heatmap-container');
            const spendingMap = {};
            let maxSpend = 0;
            data.heatmap.forEach(d => {
                spendingMap[d.date] = d.total;
                if (d.total > maxSpend) maxSpend = d.total;
            });

            // Generate 12 months grid
            let html = '<div class="heatmap-grid">';
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            // Month labels
            html += '<div class="heatmap-months">';
            monthNames.forEach(m => html += `<span>${m}</span>`);
            html += '</div>';

            // Cells: 31 rows x 12 columns
            html += '<div class="heatmap-cells">';
            for (let day = 1; day <= 31; day++) {
                for (let month = 0; month < 12; month++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const d = new Date(year, month, day);
                    const isValid = d.getMonth() === month && d.getDate() === day;

                    if (!isValid) {
                        html += '<div class="heatmap-cell empty"></div>';
                        continue;
                    }

                    const amount = spendingMap[dateStr] || 0;
                    const intensity = maxSpend > 0 ? amount / maxSpend : 0;
                    let bg = 'var(--bg-card)';
                    if (intensity > 0.75) bg = 'rgba(52,211,153,0.9)';
                    else if (intensity > 0.5) bg = 'rgba(52,211,153,0.6)';
                    else if (intensity > 0.25) bg = 'rgba(52,211,153,0.4)';
                    else if (intensity > 0) bg = 'rgba(52,211,153,0.2)';

                    html += `<div class="heatmap-cell" style="background:${bg};" title="${dateStr}: ${formatCurrency(amount)}"></div>`;
                }
            }
            html += '</div></div>';
            container.innerHTML = html;
        } catch (err) {
            console.error('Load heatmap error:', err);
        }
    }

    // Insights & stats
    async function loadInsights() {
        try {
            const res = await fetch('/api/analytics/insights');
            const data = await res.json();

            if (data.stats) {
                $('#stat-income').textContent = formatCurrency(data.stats.currentIncome);
                $('#stat-expense').textContent = formatCurrency(data.stats.currentExpense);
                $('#stat-savings-rate').textContent = data.stats.savingsRate + '%';
                $('#stat-txn-count').textContent = data.stats.transactionCount;
            }

            const insightsGrid = $('#insights-grid');
            if (insightsGrid && data.insights) {
                insightsGrid.innerHTML = data.insights.map(i => `
                    <div class="insight-card insight-${i.type}">
                        <div class="insight-icon">${i.icon}</div>
                        <div class="insight-body">
                            <div class="insight-title">${i.title}</div>
                            <div class="insight-text">${i.text}</div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Load insights error:', err);
        }
    }

    // Year selector
    const yearSelect = $('#heatmap-year');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 3; y--) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        yearSelect.appendChild(opt);
    }
    yearSelect.addEventListener('change', () => loadHeatmap(yearSelect.value));

    // Init
    async function init() {
        const loggedIn = await checkAuth();
        if (!loggedIn) return;

        await Promise.all([
            loadNetworthChart(),
            loadHeatmap(currentYear),
            loadInsights(),
        ]);

        const lo = $('#loading-overlay');
        lo.classList.add('hidden');
        setTimeout(() => lo.remove(), 500);
    }
    init();
})();
