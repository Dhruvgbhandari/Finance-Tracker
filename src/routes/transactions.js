const express = require('express');
const { body, validationResult } = require('express-validator');
const { Transaction } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Salary', 'Other'];
const VALID_TYPES = ['income', 'expense'];

// GET /api/transactions
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const type = req.query.type;
        const search = req.query.search;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;

        const query = { user_id: userId };

        if (category && VALID_CATEGORIES.includes(category)) {
            query.category = category;
        }

        if (type && VALID_TYPES.includes(type)) {
            query.type = type;
        }

        if (search && search.trim()) {
            query.$or = [
                { description: { $regex: search.trim(), $options: 'i' } },
                { category: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = dateFrom;
            if (dateTo) query.date.$lte = dateTo;
        }

        // Get total count
        const total = await Transaction.countDocuments(query);

        // Get paginated results
        const transactions = await Transaction.find(query)
            .sort({ date: sortOrder, created_at: -1 })
            .skip(skip)
            .limit(limit);

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
router.get('/export/csv', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const transactions = await Transaction.find({ user_id: userId }).sort({ date: -1 });

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

// POST /api/transactions/import/csv
router.post('/import/csv', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { csvData } = req.body;

        if (!csvData || typeof csvData !== 'string') {
            return res.status(400).json({ error: 'CSV data is required' });
        }

        // Parse CSV — handle quoted fields
        const lines = csvData.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
        }

        // Parse header (case-insensitive matching)
        const headerRaw = parseCsvLine(lines[0]);
        const header = headerRaw.map(h => h.trim().toLowerCase());

        // Find column indices
        const dateIdx = header.findIndex(h => h === 'date');
        const typeIdx = header.findIndex(h => h === 'type');
        const categoryIdx = header.findIndex(h => h === 'category');
        const amountIdx = header.findIndex(h => h === 'amount');
        const descIdx = header.findIndex(h => h === 'description' || h === 'desc' || h === 'note' || h === 'notes');

        if (dateIdx === -1 || amountIdx === -1) {
            return res.status(400).json({
                error: 'CSV must contain at least "Date" and "Amount" columns. Optional: Type, Category, Description'
            });
        }

        let imported = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            const fields = parseCsvLine(lines[i]);
            if (fields.length === 0) continue;

            try {
                const date = fields[dateIdx]?.trim();
                const amount = parseFloat(fields[amountIdx]?.trim());
                let type = typeIdx !== -1 ? fields[typeIdx]?.trim().toLowerCase() : '';
                let category = categoryIdx !== -1 ? fields[categoryIdx]?.trim() : 'Other';
                const description = descIdx !== -1 ? (fields[descIdx]?.trim() || '') : '';

                // Validate date
                if (!date || isNaN(Date.parse(date))) {
                    skipped++;
                    errors.push(`Row ${i + 1}: Invalid date "${date}"`);
                    continue;
                }

                // Normalize date to YYYY-MM-DD
                const parsedDate = new Date(date);
                const isoDate = parsedDate.toISOString().split('T')[0];

                // Validate amount
                if (isNaN(amount) || amount <= 0) {
                    // If amount is negative, treat as expense with positive value
                    if (!isNaN(amount) && amount < 0) {
                        type = 'expense';
                    } else {
                        skipped++;
                        errors.push(`Row ${i + 1}: Invalid amount`);
                        continue;
                    }
                }

                // Infer type from amount sign if not provided
                if (!VALID_TYPES.includes(type)) {
                    type = amount < 0 ? 'expense' : 'income';
                }

                // Normalize category
                const matchedCategory = VALID_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());
                category = matchedCategory || 'Other';

                const absAmount = Math.abs(amount);

                await Transaction.create({
                    user_id: userId,
                    type,
                    amount: absAmount,
                    category,
                    description,
                    date: isoDate
                });
                imported++;
            } catch (rowErr) {
                skipped++;
                errors.push(`Row ${i + 1}: ${rowErr.message}`);
            }
        }

        res.json({
            message: `Imported ${imported} transaction${imported !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`,
            imported,
            skipped,
            errors: errors.slice(0, 10), // return first 10 errors max
        });
    } catch (err) {
        console.error('Import CSV error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Simple CSV line parser that handles quoted fields
function parseCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}

// POST /api/transactions
router.post('/', requireAuth, [
    body('type').isIn(VALID_TYPES).withMessage('Type must be income or expense'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('category').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('description').optional().isString().trim().isLength({ max: 255 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { type, amount, category, date, description } = req.body;
        const userId = req.session.userId;

        const transaction = await Transaction.create({
            user_id: userId,
            type,
            amount,
            category,
            date,
            description: description || ''
        });

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
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { id } = req.params;
        const userId = req.session.userId;

        const updated = await Transaction.findOneAndUpdate(
            { _id: id, user_id: userId },
            { $set: req.body },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ message: 'Transaction updated', transaction: updated });
    } catch (err) {
        console.error('Update transaction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/transactions/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const deleted = await Transaction.findOneAndDelete({ _id: id, user_id: userId });
        if (!deleted) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ message: 'Transaction deleted' });
    } catch (err) {
        console.error('Delete transaction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
