const express = require('express');
const { body, validationResult } = require('express-validator');
const { queryAll, queryOne, runSql } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Salary', 'Other'];

// GET /api/budgets?month=YYYY-MM
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const month = req.query.month || new Date().toISOString().slice(0, 7);

        // Get all budgets for this month
        const budgets = queryAll(
            'SELECT * FROM budgets WHERE user_id = ? AND month = ? ORDER BY category ASC',
            [userId, month]
        );

        // Get actual spending per category for the month
        const spending = queryAll(`
            SELECT category, COALESCE(SUM(amount), 0) as spent
            FROM transactions
            WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?
            GROUP BY category
        `, [userId, month]);

        const spendingMap = {};
        spending.forEach(s => { spendingMap[s.category] = s.spent; });

        // Merge budget + spent data
        const result = budgets.map(b => ({
            ...b,
            spent: spendingMap[b.category] || 0,
            percentage: Math.round(((spendingMap[b.category] || 0) / b.amount) * 100),
        }));

        // Total budget vs total spent
        const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = Object.values(spendingMap).reduce((sum, v) => sum + v, 0);

        res.json({
            budgets: result,
            totalBudget,
            totalSpent,
            month,
        });
    } catch (err) {
        console.error('Get budgets error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/budgets  — create or update (upsert)
router.post('/', requireAuth, [
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
    body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM'),
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { category, amount, month } = req.body;
        const userId = req.session.userId;

        // Upsert: update if exists, else insert
        const existing = queryOne(
            'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ?',
            [userId, category, month]
        );

        if (existing) {
            runSql('UPDATE budgets SET amount = ? WHERE id = ?', [amount, existing.id]);
            const updated = queryOne('SELECT * FROM budgets WHERE id = ?', [existing.id]);
            return res.json({ message: 'Budget updated', budget: updated });
        }

        const result = runSql(
            'INSERT INTO budgets (user_id, category, amount, month) VALUES (?, ?, ?, ?)',
            [userId, category, amount, month]
        );

        const budget = queryOne('SELECT * FROM budgets WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json({ message: 'Budget created', budget });
    } catch (err) {
        console.error('Create budget error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/budgets/:id
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const existing = queryOne('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        runSql('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Budget deleted' });
    } catch (err) {
        console.error('Delete budget error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
