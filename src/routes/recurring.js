const express = require('express');
const { body, validationResult } = require('express-validator');
const { queryAll, queryOne, runSql } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Salary', 'Other'];
const VALID_TYPES = ['income', 'expense'];
const VALID_FREQUENCIES = ['weekly', 'monthly', 'yearly'];

// GET /api/recurring
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const recurring = queryAll(
            'SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY next_date ASC',
            [userId]
        );
        res.json({ recurring });
    } catch (err) {
        console.error('Get recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/recurring
router.post('/', requireAuth, [
    body('type').isIn(VALID_TYPES).withMessage('Type must be income or expense'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('frequency').isIn(VALID_FREQUENCIES).withMessage('Frequency must be weekly, monthly, or yearly'),
    body('next_date').isISO8601().withMessage('Valid start date required'),
    body('description').optional().isString().trim().isLength({ max: 255 }),
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { type, amount, category, frequency, next_date, description } = req.body;
        const userId = req.session.userId;

        const result = runSql(
            'INSERT INTO recurring_transactions (user_id, type, amount, category, description, frequency, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, type, amount, category, description || '', frequency, next_date]
        );

        const recurring = queryOne('SELECT * FROM recurring_transactions WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json({ message: 'Recurring transaction created', recurring });
    } catch (err) {
        console.error('Create recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/recurring/:id/toggle — activate/deactivate
router.put('/:id/toggle', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const existing = queryOne('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Recurring transaction not found' });
        }

        const newStatus = existing.is_active ? 0 : 1;
        runSql('UPDATE recurring_transactions SET is_active = ? WHERE id = ?', [newStatus, id]);

        const updated = queryOne('SELECT * FROM recurring_transactions WHERE id = ?', [id]);
        res.json({ message: newStatus ? 'Activated' : 'Paused', recurring: updated });
    } catch (err) {
        console.error('Toggle recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/recurring/:id
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const existing = queryOne('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Recurring transaction not found' });
        }

        runSql('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Recurring transaction deleted' });
    } catch (err) {
        console.error('Delete recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
