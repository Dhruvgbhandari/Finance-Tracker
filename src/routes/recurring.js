const express = require('express');
const { body, validationResult } = require('express-validator');
const { RecurringTransaction } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Salary', 'Other'];
const VALID_TYPES = ['income', 'expense'];
const VALID_FREQUENCIES = ['weekly', 'monthly', 'yearly'];

// GET /api/recurring
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const recurring = await RecurringTransaction.find({ user_id: userId }).sort({ next_date: 1 });
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
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { type, amount, category, frequency, next_date, description } = req.body;
        const userId = req.session.userId;

        const recurring = await RecurringTransaction.create({
            user_id: userId,
            type,
            amount,
            category,
            frequency,
            next_date,
            description: description || ''
        });

        res.status(201).json({ message: 'Recurring transaction created', recurring });
    } catch (err) {
        console.error('Create recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/recurring/:id/toggle — activate/deactivate
router.put('/:id/toggle', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const existing = await RecurringTransaction.findOne({ _id: id, user_id: userId });
        if (!existing) {
            return res.status(404).json({ error: 'Recurring transaction not found' });
        }

        existing.is_active = !existing.is_active;
        await existing.save();

        res.json({ message: existing.is_active ? 'Activated' : 'Paused', recurring: existing });
    } catch (err) {
        console.error('Toggle recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/recurring/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const deleted = await RecurringTransaction.findOneAndDelete({ _id: id, user_id: userId });
        if (!deleted) {
            return res.status(404).json({ error: 'Recurring transaction not found' });
        }

        res.json({ message: 'Recurring transaction deleted' });
    } catch (err) {
        console.error('Delete recurring error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
