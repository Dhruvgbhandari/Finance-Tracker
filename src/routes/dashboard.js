const express = require('express');
const mongoose = require('mongoose');
const { Transaction, User } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId);
        const month = req.query.month; // format: YYYY-MM

        const match = { user_id: userId };
        if (month) {
            match.date = { $regex: `^${month}` };
        }

        const totals = await Transaction.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const income = totals.find(t => t._id === 'income')?.total || 0;
        const expense = totals.find(t => t._id === 'expense')?.total || 0;

        // Get user's starting balance
        const user = await User.findById(userId).select('starting_balance');
        const startingBalance = user ? (user.starting_balance || 0) : 0;

        res.json({
            totalIncome: income,
            totalExpenses: expense,
            startingBalance,
            balance: startingBalance + income - expense,
        });
    } catch (err) {
        console.error('Dashboard summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/dashboard/monthly
router.get('/monthly', requireAuth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId);
        const months = Math.min(12, Math.max(1, parseInt(req.query.months) || 6));

        // Calculate the date range for the last N months
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const startDateStr = startDate.toISOString().slice(0, 7);

        const data = await Transaction.aggregate([
            {
                $match: {
                    user_id: userId,
                    date: { $gte: startDateStr }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $substr: ['$date', 0, 7] },
                        type: '$type'
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.month': 1 } }
        ]);

        // Reshape into {month, income, expense} format
        const monthMap = {};
        for (const row of data) {
            const m = row._id.month;
            if (!monthMap[m]) {
                monthMap[m] = { month: m, income: 0, expense: 0 };
            }
            monthMap[m][row._id.type] = row.total;
        }

        res.json({ monthly: Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month)) });
    } catch (err) {
        console.error('Dashboard monthly error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/dashboard/categories
router.get('/categories', requireAuth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId);
        const month = req.query.month; // format: YYYY-MM

        const match = { user_id: userId, type: 'expense' };
        if (month) {
            match.date = { $regex: `^${month}` };
        }

        const categories = await Transaction.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { total: -1 } },
            {
                $project: {
                    _id: 0,
                    category: '$_id',
                    total: 1
                }
            }
        ]);

        res.json({ categories });
    } catch (err) {
        console.error('Dashboard categories error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
