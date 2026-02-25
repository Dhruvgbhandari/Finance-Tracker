const express = require('express');
const { body, validationResult } = require('express-validator');
const { queryAll, queryOne, runSql } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Salary', 'Other'];
const VALID_TYPES = ['income', 'expense'];

// GET /api/transactions
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;
        const category = req.query.category;
        const type = req.query.type;
        const search = req.query.search;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;
        const sortOrder = req.query.sort === 'asc' ? 'ASC' : 'DESC';

        let whereClause = 'WHERE user_id = ?';
        const params = [userId];

        if (category && VALID_CATEGORIES.includes(category)) {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        if (type && VALID_TYPES.includes(type)) {
            whereClause += ' AND type = ?';
            params.push(type);
        }

        if (search && search.trim()) {
            whereClause += ' AND (description LIKE ? OR category LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }

        if (dateFrom) {
            whereClause += ' AND date >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            whereClause += ' AND date <= ?';
            params.push(dateTo);
        }

        // Get total count
        const countResult = queryOne(`SELECT COUNT(*) as total FROM transactions ${whereClause}`, params);
        const total = countResult.total;

        // Get paginated results
        const transactions = queryAll(
            `SELECT * FROM transactions ${whereClause} ORDER BY date ${sortOrder}, created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('Get transactions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/transactions/export/csv
router.get('/export/csv', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const transactions = queryAll(
            'SELECT date, type, category, amount, description FROM transactions WHERE user_id = ? ORDER BY date DESC',
            [userId]
        );

        const header = 'Date,Type,Category,Amount,Description\n';
        const rows = transactions.map(t => {
            const desc = (t.description || '').replace(/"/g, '""');
            return `${t.date},${t.type},${t.category},${t.amount},"${desc}"`;
        }).join('\n');

        const csv = header + rows;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=moneytrack-transactions.csv');
        res.send(csv);
    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/transactions
router.post('/', requireAuth, [
    body('type').isIn(VALID_TYPES).withMessage('Type must be income or expense'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('description').optional().isString().trim().isLength({ max: 255 }),
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { type, amount, category, date, description } = req.body;
        const userId = req.session.userId;

        const result = runSql(
            'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, type, amount, category, description || '', date]
        );

        const transaction = queryOne('SELECT * FROM transactions WHERE id = ?', [result.lastInsertRowid]);

        res.status(201).json({ message: 'Transaction added', transaction });
    } catch (err) {
        console.error('Create transaction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/transactions/:id
router.put('/:id', requireAuth, [
    body('type').isIn(VALID_TYPES).withMessage('Type must be income or expense'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('description').optional().isString().trim().isLength({ max: 255 }),
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { id } = req.params;
        const userId = req.session.userId;

        // Ownership check
        const existing = queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const { type, amount, category, date, description } = req.body;

        runSql(
            'UPDATE transactions SET type = ?, amount = ?, category = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
            [type, amount, category, description || '', date, id, userId]
        );

        const updated = queryOne('SELECT * FROM transactions WHERE id = ?', [id]);
        res.json({ message: 'Transaction updated', transaction: updated });
    } catch (err) {
        console.error('Update transaction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/transactions/:id
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const existing = queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        runSql('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Transaction deleted' });
    } catch (err) {
        console.error('Delete transaction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
