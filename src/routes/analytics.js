const express = require('express');
const { queryAll, queryOne } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/networth?months=12
router.get('/networth', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 12));

        // Get starting balance
        const user = queryOne('SELECT starting_balance FROM users WHERE id = ?', [userId]);
        const startingBalance = user ? (user.starting_balance || 0) : 0;

        // Get monthly income and expense totals
        const data = queryAll(`
            SELECT
                strftime('%Y-%m', date) as month,
                type,
                COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_id = ?
              AND date >= date('now', '-' || ? || ' months')
            GROUP BY month, type
            ORDER BY month ASC
        `, [userId, months]);

        // Build cumulative net worth
        const monthMap = {};
        for (const row of data) {
            if (!monthMap[row.month]) {
                monthMap[row.month] = { income: 0, expense: 0 };
            }
            monthMap[row.month][row.type] = row.total;
        }

        let cumulative = startingBalance;
        // Also need historical data before the window to get the correct starting point
        const priorData = queryOne(`
            SELECT
                COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
            FROM transactions
            WHERE user_id = ? AND date < date('now', '-' || ? || ' months')
        `, [userId, months]);

        if (priorData) {
            cumulative += priorData.income - priorData.expense;
        }

        const sortedMonths = Object.keys(monthMap).sort();
        const networth = sortedMonths.map(month => {
            cumulative += monthMap[month].income - monthMap[month].expense;
            return { month, value: cumulative };
        });

        res.json({ networth, startingBalance });
    } catch (err) {
        console.error('Analytics networth error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/analytics/heatmap?year=YYYY
router.get('/heatmap', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const year = req.query.year || new Date().getFullYear().toString();

        const data = queryAll(`
            SELECT date, COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_id = ? AND type = 'expense' AND strftime('%Y', date) = ?
            GROUP BY date
            ORDER BY date ASC
        `, [userId, year]);

        res.json({ heatmap: data, year });
    } catch (err) {
        console.error('Analytics heatmap error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/analytics/insights
router.get('/insights', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Previous month
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        // Current month totals
        const currentIncome = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?
        `, [userId, currentMonth]);

        const currentExpense = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?
        `, [userId, currentMonth]);

        // Previous month totals
        const prevIncome = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?
        `, [userId, prevMonth]);

        const prevExpense = queryOne(`
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?
        `, [userId, prevMonth]);

        // Top spending category this month
        const topCategory = queryOne(`
            SELECT category, COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?
            GROUP BY category ORDER BY total DESC LIMIT 1
        `, [userId, currentMonth]);

        // Savings rate
        const income = currentIncome ? currentIncome.total : 0;
        const expense = currentExpense ? currentExpense.total : 0;
        const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

        // Month-over-month expense change
        const prevExp = prevExpense ? prevExpense.total : 0;
        const expenseChange = prevExp > 0 ? Math.round(((expense - prevExp) / prevExp) * 100) : 0;

        // Transaction count this month
        const txnCount = queryOne(`
            SELECT COUNT(*) as count FROM transactions
            WHERE user_id = ? AND strftime('%Y-%m', date) = ?
        `, [userId, currentMonth]);

        // Average daily spending this month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const avgDailySpending = daysPassed > 0 ? Math.round(expense / daysPassed) : 0;

        // Build insights
        const insights = [];

        if (savingsRate >= 30) {
            insights.push({
                type: 'positive',
                icon: '🎉',
                title: 'Great Savings!',
                text: `You're saving ${savingsRate}% of your income this month. Keep it up!`,
            });
        } else if (savingsRate >= 0) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Low Savings Rate',
                text: `Your savings rate is ${savingsRate}%. Try to save at least 20-30% of your income.`,
            });
        } else {
            insights.push({
                type: 'danger',
                icon: '🚨',
                title: 'Overspending Alert',
                text: `You're spending more than you earn. Expenses exceed income by ₹${Math.abs(income - expense).toLocaleString()}.`,
            });
        }

        if (topCategory) {
            const categoryPct = income > 0 ? Math.round((topCategory.total / income) * 100) : 0;
            insights.push({
                type: categoryPct > 40 ? 'warning' : 'info',
                icon: '📊',
                title: 'Top Spending Category',
                text: `${topCategory.category} takes up ₹${topCategory.total.toLocaleString()} (${categoryPct}% of income).`,
            });
        }

        if (expenseChange > 20) {
            insights.push({
                type: 'warning',
                icon: '📈',
                title: 'Spending Spike',
                text: `Expenses are up ${expenseChange}% compared to last month.`,
            });
        } else if (expenseChange < -10) {
            insights.push({
                type: 'positive',
                icon: '📉',
                title: 'Spending Down!',
                text: `You've reduced spending by ${Math.abs(expenseChange)}% vs. last month.`,
            });
        }

        insights.push({
            type: 'info',
            icon: '📅',
            title: 'Daily Average',
            text: `You're spending ≈ ₹${avgDailySpending.toLocaleString()}/day. Projected monthly: ₹${(avgDailySpending * daysInMonth).toLocaleString()}.`,
        });

        res.json({
            insights,
            stats: {
                currentIncome: income,
                currentExpense: expense,
                savingsRate,
                expenseChange,
                topCategory: topCategory ? topCategory.category : null,
                topCategoryAmount: topCategory ? topCategory.total : 0,
                transactionCount: txnCount ? txnCount.count : 0,
                avgDailySpending,
            },
        });
    } catch (err) {
        console.error('Analytics insights error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
