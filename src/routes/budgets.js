const express = require('express');
const { body, validationResult } = require('express-validator');
const { Budget, Transaction } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Salary', 'Other'];

// GET /api/budgets?month=YYYY-MM
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const month = req.query.month || new Date().toISOString().slice(0, 7);

        // Get all budgets for this month
        const budgets = await Budget.find({ user_id: userId, month }).sort({ category: 1 });

        // Get actual spending per category for the month
        const spending = await Transaction.aggregate([
            {
                $match: {
                    user_id: userId,
                    type: 'expense',
                    date: { $regex: `^${month}` }
                }
            },
            {
                $group: {
                    _id: '$category',
                    spent: { $sum: '$amount' }
                }
            }
        ]);

        const spendingMap = {};
        spending.forEach(s => { spendingMap[s._id] = s.spent; });

        // Merge budget + spent data
        const result = budgets.map(b => ({
            id: b._id,
            category: b.category,
            amount: b.amount,
            month: b.month,
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
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { category, amount, month } = req.body;
        const userId = req.session.userId;

        // Upsert: update if exists, else insert
        const existing = await Budget.findOne({ user_id: userId, category, month });
        const budget = await Budget.findOneAndUpdate(
            { user_id: userId, category, month },
            { amount },
            { upsert: true, new: true }
        );

        res.status(existing ? 200 : 201).json({ 
            message: existing ? 'Budget updated' : 'Budget created', 
            budget: {
                id: budget._id,
                category: budget.category,
                amount: budget.amount,
                month: budget.month
            }
        });
    } catch (err) {
        console.error('Create budget error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/budgets/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const deleted = await Budget.findOneAndDelete({ _id: id, user_id: userId });
        if (!deleted) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        res.json({ message: 'Budget deleted' });
    } catch (err) {
        console.error('Delete budget error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
