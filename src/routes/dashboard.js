const express = require('express');
const { queryAll, queryOne } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const month = req.query.month; // format: YYYY-MM

        let dateFilter = '';
        const incomeParams = [userId];
        const expenseParams = [userId];

        if (month) {
            dateFilter = "AND strftime('%Y-%m', date) = ?";
            incomeParams.push(month);
            expenseParams.push(month);
        }

        const income = queryOne(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' ${dateFilter}`,
            incomeParams
        );

        const expense = queryOne(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' ${dateFilter}`,
            expenseParams
        );

        // Get user's starting balance
        const user = queryOne('SELECT starting_balance FROM users WHERE id = ?', [userId]);
        const startingBalance = user ? (user.starting_balance || 0) : 0;

        res.json({
            totalIncome: income.total,
            totalExpenses: expense.total,
            startingBalance,
            balance: startingBalance + income.total - expense.total,
        });
    } catch (err) {
        console.error('Dashboard summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/dashboard/monthly
router.get('/monthly', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const months = Math.min(12, Math.max(1, parseInt(req.query.months) || 6));

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

        // Reshape into {month, income, expense} format
        const monthMap = {};
        for (const row of data) {
            if (!monthMap[row.month]) {
                monthMap[row.month] = { month: row.month, income: 0, expense: 0 };
            }
            monthMap[row.month][row.type] = row.total;
        }

        res.json({ monthly: Object.values(monthMap) });
    } catch (err) {
        console.error('Dashboard monthly error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/dashboard/categories
router.get('/categories', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const month = req.query.month; // format: YYYY-MM

        let dateFilter = '';
        const params = [userId];

        if (month) {
            dateFilter = "AND strftime('%Y-%m', date) = ?";
            params.push(month);
        }

        const categories = queryAll(`
            SELECT category, COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_id = ? AND type = 'expense' ${dateFilter}
            GROUP BY category
            ORDER BY total DESC
        `, params);

        res.json({ categories });
    } catch (err) {
        console.error('Dashboard categories error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
