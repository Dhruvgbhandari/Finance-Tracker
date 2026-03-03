const express = require('express');
const mongoose = require('mongoose');
const { Transaction, User } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/networth?months=12
router.get('/networth', requireAuth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId);
        const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 12));

        // Get starting balance
        const user = await User.findById(userId).select('starting_balance');
        const startingBalance = user ? (user.starting_balance || 0) : 0;

        // Calculate dates
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const startDateStr = startDate.toISOString().slice(0, 7);

        // Get monthly income and expense totals
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

        // Prior data for cumulative starting point
        const priorResults = await Transaction.aggregate([
            {
                $match: {
                    user_id: userId,
                    date: { $lt: startDateStr }
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        let cumulative = startingBalance;
        const priorIncome = priorResults.find(r => r._id === 'income')?.total || 0;
        const priorExpense = priorResults.find(r => r._id === 'expense')?.total || 0;
        cumulative += (priorIncome - priorExpense);

        // Build cumulative net worth
        const monthMap = {};
        for (const row of data) {
            const m = row._id.month;
            if (!monthMap[m]) monthMap[m] = { income: 0, expense: 0 };
            monthMap[m][row._id.type] = row.total;
        }

        const sortedMonths = Object.keys(monthMap).sort();
        const networth = sortedMonths.map(month => {
            cumulative += monthMap[month].income - monthMap[month].expense;
            return { month, value: cumulative };
        });

        res.json({ networth, startingBalance });
    } catch (err) {
        console.error('Analytics networth error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/analytics/heatmap?year=YYYY
router.get('/heatmap', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const year = req.query.year || new Date().getFullYear().toString();

        const data = await Transaction.aggregate([
            {
                $match: {
                    user_id: userId,
                    type: 'expense',
                    date: { $regex: `^${year}` }
                }
            },
            {
                $group: {
                    _id: '$date',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    total: 1
                }
            }
        ]);

        res.json({ heatmap: data, year });
    } catch (err) {
        console.error('Analytics heatmap error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/analytics/insights
router.get('/insights', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);

        // Previous month
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = prevDate.toISOString().slice(0, 7);

        // Aggregation for stats
        const statsData = await Transaction.aggregate([
            {
                $match: {
                    user_id: userId,
                    date: { $regex: `^(${currentMonth}|${prevMonth})` }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $substr: ['$date', 0, 7] },
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const findStat = (m, t) => statsData.find(s => s._id.month === m && s._id.type === t)?.total || 0;
        const currentIncome = findStat(currentMonth, 'income');
        const currentExpense = findStat(currentMonth, 'expense');
        const prevIncome = findStat(prevMonth, 'income');
        const prevExpense = findStat(prevMonth, 'expense');
        const txnCount = statsData.filter(s => s._id.month === currentMonth).reduce((acc, s) => acc + s.count, 0);

        // Top spending category this month
        const topCategoryData = await Transaction.aggregate([
            {
                $match: {
                    user_id: userId,
                    type: 'expense',
                    date: { $regex: `^${currentMonth}` }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { total: -1 } },
            { $limit: 1 }
        ]);
        const topCategory = topCategoryData.length > 0 ? topCategoryData[0] : null;

        // Savings rate
        const income = currentIncome;
        const expense = currentExpense;
        const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

        // Month-over-month expense change
        const prevExp = prevExpense;
        const expenseChange = prevExp > 0 ? Math.round(((expense - prevExp) / prevExp) * 100) : 0;

        // Average daily spending this month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const avgDailySpending = daysPassed > 0 ? Math.round(expense / daysPassed) : 0;

        // Build insights
        const insights = [];

        if (savingsRate >= 30) {
            insights.push({
                type: 'positive',
                icon: '🎉',
                title: 'Great Savings!',
                text: `You're saving ${savingsRate}% of your income this month. Keep it up!`,
            });
        } else if (savingsRate >= 0) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Low Savings Rate',
                text: `Your savings rate is ${savingsRate}%. Try to save at least 20-30% of your income.`,
            });
        } else {
            insights.push({
                type: 'danger',
                icon: '🚨',
                title: 'Overspending Alert',
                text: `You're spending more than you earn. Expenses exceed income by ₹${Math.abs(income - expense).toLocaleString()}.`,
            });
        }

        if (topCategory) {
            const categoryPct = income > 0 ? Math.round((topCategory.total / income) * 100) : 0;
            insights.push({
                type: categoryPct > 40 ? 'warning' : 'info',
                icon: '📊',
                title: 'Top Spending Category',
                text: `${topCategory._id} takes up ₹${topCategory.total.toLocaleString()} (${categoryPct}% of income).`,
            });
        }

        if (expenseChange > 20) {
            insights.push({
                type: 'warning',
                icon: '📈',
                title: 'Spending Spike',
                text: `Expenses are up ${expenseChange}% compared to last month.`,
            });
        } else if (expenseChange < -10) {
            insights.push({
                type: 'positive',
                icon: '📉',
                title: 'Spending Down!',
                text: `You've reduced spending by ${Math.abs(expenseChange)}% vs. last month.`,
            });
        }

        insights.push({
            type: 'info',
            icon: '📅',
            title: 'Daily Average',
            text: `You're spending ≈ ₹${avgDailySpending.toLocaleString()}/day. Projected monthly: ₹${(avgDailySpending * daysInMonth).toLocaleString()}.`,
        });

        res.json({
            insights,
            stats: {
                currentIncome: income,
                currentExpense: expense,
                savingsRate,
                expenseChange,
                topCategory: topCategory ? topCategory._id : null,
                topCategoryAmount: topCategory ? topCategory.total : 0,
                transactionCount: txnCount,
                avgDailySpending,
            },
        });
    } catch (err) {
        console.error('Analytics insights error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
