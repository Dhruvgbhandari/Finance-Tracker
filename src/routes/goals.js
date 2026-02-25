const express = require('express');
const { body, validationResult } = require('express-validator');
const { queryAll, queryOne, runSql } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const GOAL_ICONS = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '🎓', '💍', '🏖️', '💰', '🎮', '📸'];

// GET /api/goals
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const goals = queryAll(
            'SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        const result = goals.map(g => ({
            ...g,
            percentage: g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0,
            remaining: Math.max(0, g.target_amount - g.current_amount),
            daysLeft: g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24))) : null,
        }));

        res.json({ goals: result });
    } catch (err) {
        console.error('Get goals error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/goals
router.post('/', requireAuth, [
    body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 chars)'),
    body('target_amount').isFloat({ gt: 0 }).withMessage('Target must be positive'),
    body('deadline').optional({ nullable: true }).isISO8601().withMessage('Invalid deadline date'),
    body('icon').optional().isIn(GOAL_ICONS),
    body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Invalid color hex'),
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { name, target_amount, deadline, icon, color } = req.body;
        const userId = req.session.userId;

        const result = runSql(
            'INSERT INTO savings_goals (user_id, name, target_amount, deadline, icon, color) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, name, target_amount, deadline || null, icon || '🎯', color || '#60a5fa']
        );

        const goal = queryOne('SELECT * FROM savings_goals WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json({ message: 'Goal created', goal });
    } catch (err) {
        console.error('Create goal error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/goals/:id  — update or contribute
router.put('/:id', requireAuth, [
    body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('target_amount').optional().isFloat({ gt: 0 }),
    body('contribute').optional().isFloat({ gt: 0 }),
    body('deadline').optional({ nullable: true }),
    body('icon').optional(),
    body('color').optional(),
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { id } = req.params;
        const userId = req.session.userId;

        const existing = queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const { name, target_amount, contribute, deadline, icon, color } = req.body;

        // If contributing, just add to current_amount
        if (contribute) {
            const newAmount = existing.current_amount + contribute;
            runSql('UPDATE savings_goals SET current_amount = ? WHERE id = ?', [newAmount, id]);
        } else {
            // Update fields
            runSql(
                `UPDATE savings_goals SET
                    name = COALESCE(?, name),
                    target_amount = COALESCE(?, target_amount),
                    deadline = COALESCE(?, deadline),
                    icon = COALESCE(?, icon),
                    color = COALESCE(?, color)
                WHERE id = ? AND user_id = ?`,
                [name || null, target_amount || null, deadline !== undefined ? deadline : null, icon || null, color || null, id, userId]
            );
        }

        const updated = queryOne('SELECT * FROM savings_goals WHERE id = ?', [id]);
        res.json({ message: contribute ? 'Contribution added' : 'Goal updated', goal: updated });
    } catch (err) {
        console.error('Update goal error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const existing = queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        runSql('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Goal deleted' });
    } catch (err) {
        console.error('Delete goal error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
