const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/moneytrack';

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    starting_balance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    created_at: { type: Date, default: Date.now }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['income', 'expense'] },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    date: { type: String, required: true }, // YYYY-MM-DD
    recurring_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringTransaction', default: null },
    created_at: { type: Date, default: Date.now }
});

// Budget Schema
const budgetSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    month: { type: String, required: true } // YYYY-MM
});
budgetSchema.index({ user_id: 1, category: 1, month: 1 }, { unique: true });

// Savings Goal Schema
const savingsGoalSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    target_amount: { type: Number, required: true, min: 0 },
    current_amount: { type: Number, default: 0 },
    deadline: { type: String }, // YYYY-MM-DD
    icon: { type: String, default: '🎯' },
    color: { type: String, default: '#60a5fa' },
    created_at: { type: Date, default: Date.now }
});

// Recurring Transaction Schema
const recurringTransactionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['income', 'expense'] },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    frequency: { type: String, required: true, enum: ['weekly', 'monthly', 'yearly'] },
    next_date: { type: String, required: true }, // YYYY-MM-DD
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const SavingsGoal = mongoose.model('SavingsGoal', savingsGoalSchema);
const RecurringTransaction = mongoose.model('RecurringTransaction', recurringTransactionSchema);

async function initDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        throw err;
    }
}

module.exports = {
    initDatabase,
    User,
    Transaction,
    Budget,
    SavingsGoal,
    RecurringTransaction,
    mongoose
};
