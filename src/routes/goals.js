const express = require('express');
const { body, validationResult } = require('express-validator');
const { SavingsGoal } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const GOAL_ICONS = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '🎓', '💍', '🏖️', '💰', '🎮', '📸'];

// GET /api/goals
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const goals = await SavingsGoal.find({ user_id: userId }).sort({ created_at: -1 });

        const result = goals.map(g => ({
            id: g._id,
            name: g.name,
            target_amount: g.target_amount,
            current_amount: g.current_amount,
            deadline: g.deadline,
            icon: g.icon,
            color: g.color,
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
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { name, target_amount, deadline, icon, color } = req.body;
        const userId = req.session.userId;

        const goal = await SavingsGoal.create({
            user_id: userId,
            name,
            target_amount,
            deadline: deadline || null,
            icon: icon || '🎯',
            color: color || '#60a5fa'
        });

        res.status(201).json({ message: 'Goal created', goal: { ...goal._doc, id: goal._id } });
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
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { id } = req.params;
        const userId = req.session.userId;

        let goal = await SavingsGoal.findOne({ _id: id, user_id: userId });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const { name, target_amount, contribute, deadline, icon, color } = req.body;

        // If contributing, just add to current_amount
        if (contribute) {
            goal.current_amount += contribute;
            await goal.save();
        } else {
            // Update fields
            if (name !== undefined) goal.name = name;
            if (target_amount !== undefined) goal.target_amount = target_amount;
            if (deadline !== undefined) goal.deadline = deadline;
            if (icon !== undefined) goal.icon = icon;
            if (color !== undefined) goal.color = color;
            await goal.save();
        }

        res.json({ message: contribute ? 'Contribution added' : 'Goal updated', goal: { ...goal._doc, id: goal._id } });
    } catch (err) {
        console.error('Update goal error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const deleted = await SavingsGoal.findOneAndDelete({ _id: id, user_id: userId });
        if (!deleted) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        res.json({ message: 'Goal deleted' });
    } catch (err) {
        console.error('Delete goal error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
