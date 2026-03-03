const initSqlJs = require('sql.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { User, Transaction, Budget, SavingsGoal, RecurringTransaction } = require('./src/db/database');

const DB_PATH = path.join(__dirname, 'moneytrack.db');

async function migrate() {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/moneytrack');
        console.log('✅ Connected to MongoDB');

        // 2. Load SQLite
        const SQL = await initSqlJs();
        if (!fs.existsSync(DB_PATH)) {
            console.log('ℹ️ No SQLite database found at', DB_PATH, '- skipping migration.');
            process.exit(0);
        }
        const buffer = fs.readFileSync(DB_PATH);
        const db = new SQL.Database(buffer);
        console.log('📂 Loaded SQLite database');

        // Helper: query SQLite
        function queryAll(sql) {
            const stmt = db.prepare(sql);
            const results = [];
            while (stmt.step()) results.push(stmt.getAsObject());
            stmt.free();
            return results;
        }

        // 3. Migrate Users
        console.log('👤 Migrating users...');
        const sqliteUsers = queryAll('SELECT * FROM users');
        const userMap = {}; // oldId -> newObjectId

        for (const u of sqliteUsers) {
            const existing = await User.findOne({ email: u.email });
            if (!existing) {
                const newUser = await User.create({
                    email: u.email,
                    password_hash: u.password_hash,
                    starting_balance: u.starting_balance,
                    currency: u.currency,
                    created_at: u.created_at
                });
                userMap[u.id] = newUser._id;
            } else {
                userMap[u.id] = existing._id;
            }
        }
        console.log(`✅ Migrated ${sqliteUsers.length} users`);

        // 4. Migrate Transactions
        console.log('💸 Migrating transactions...');
        const sqliteTxns = queryAll('SELECT * FROM transactions');
        for (const t of sqliteTxns) {
            if (!userMap[t.user_id]) continue;
            await Transaction.create({
                user_id: userMap[t.user_id],
                type: t.type,
                amount: t.amount,
                category: t.category,
                description: t.description,
                date: t.date,
                created_at: t.created_at
            });
        }
        console.log(`✅ Migrated ${sqliteTxns.length} transactions`);

        // 5. Migrate Budgets
        console.log('📅 Migrating budgets...');
        const sqliteBudgets = queryAll('SELECT * FROM budgets');
        for (const b of sqliteBudgets) {
            if (!userMap[b.user_id]) continue;
            await Budget.create({
                user_id: userMap[b.user_id],
                category: b.category,
                amount: b.amount,
                month: b.month
            });
        }
        console.log(`✅ Migrated ${sqliteBudgets.length} budgets`);

        // 6. Migrate Savings Goals
        console.log('🎯 Migrating savings goals...');
        const sqliteGoals = queryAll('SELECT * FROM savings_goals');
        for (const g of sqliteGoals) {
            if (!userMap[g.user_id]) continue;
            await SavingsGoal.create({
                user_id: userMap[g.user_id],
                name: g.name,
                target_amount: g.target_amount,
                current_amount: g.current_amount,
                deadline: g.deadline,
                icon: g.icon,
                color: g.color,
                created_at: g.created_at
            });
        }
        console.log(`✅ Migrated ${sqliteGoals.length} goals`);

        // 7. Migrate Recurring Transactions
        console.log('🔄 Migrating recurring transactions...');
        const sqliteRecurring = queryAll('SELECT * FROM recurring_transactions');
        for (const r of sqliteRecurring) {
            if (!userMap[r.user_id]) continue;
            await RecurringTransaction.create({
                user_id: userMap[r.user_id],
                type: r.type,
                amount: r.amount,
                category: r.category,
                description: r.description,
                frequency: r.frequency,
                next_date: r.next_date,
                is_active: !!r.is_active,
                created_at: r.created_at
            });
        }
        console.log(`✅ Migrated ${sqliteRecurring.length} recurring transactions`);

        console.log('🎊 Migration complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
