const { initDatabase, queryOne, runSql, execSql } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
    console.log('🌱 Seeding database...');

    await initDatabase();

    // Clear existing data
    execSql('DELETE FROM transactions');
    execSql('DELETE FROM users');

    // Create demo user
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const userResult = runSql(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        ['demo@moneytrack.com', passwordHash]
    );

    const userId = userResult.lastInsertRowid;
    console.log(`✅ Created demo user (ID: ${userId}) — email: demo@moneytrack.com / password: demo1234`);

    // Sample transactions
    const transactions = [
        { type: 'income', amount: 50000, category: 'Salary', description: 'Monthly salary', date: '2026-02-01' },
        { type: 'income', amount: 5000, category: 'Other', description: 'Freelance project', date: '2026-02-05' },
        { type: 'expense', amount: 12000, category: 'Rent', description: 'Monthly rent', date: '2026-02-01' },
        { type: 'expense', amount: 3500, category: 'Food', description: 'Groceries', date: '2026-02-03' },
        { type: 'expense', amount: 1500, category: 'Transport', description: 'Metro pass', date: '2026-02-02' },
        { type: 'expense', amount: 2000, category: 'Entertainment', description: 'Movie & dinner', date: '2026-02-07' },
        { type: 'expense', amount: 4500, category: 'Utilities', description: 'Electricity & internet', date: '2026-02-05' },
        { type: 'expense', amount: 800, category: 'Food', description: 'Coffee shop', date: '2026-02-10' },
        { type: 'income', amount: 45000, category: 'Salary', description: 'Monthly salary', date: '2026-01-01' },
        { type: 'expense', amount: 12000, category: 'Rent', description: 'Monthly rent', date: '2026-01-01' },
        { type: 'expense', amount: 4000, category: 'Food', description: 'Groceries', date: '2026-01-05' },
        { type: 'expense', amount: 1200, category: 'Transport', description: 'Uber rides', date: '2026-01-08' },
        { type: 'expense', amount: 3000, category: 'Entertainment', description: 'Concert tickets', date: '2026-01-15' },
        { type: 'expense', amount: 5000, category: 'Utilities', description: 'Bills', date: '2026-01-10' },
        { type: 'income', amount: 45000, category: 'Salary', description: 'Monthly salary', date: '2025-12-01' },
        { type: 'expense', amount: 12000, category: 'Rent', description: 'Monthly rent', date: '2025-12-01' },
        { type: 'expense', amount: 5500, category: 'Food', description: 'Holiday groceries', date: '2025-12-20' },
        { type: 'expense', amount: 8000, category: 'Entertainment', description: 'Holiday gifts', date: '2025-12-24' },
        { type: 'income', amount: 45000, category: 'Salary', description: 'Monthly salary', date: '2025-11-01' },
        { type: 'expense', amount: 12000, category: 'Rent', description: 'Monthly rent', date: '2025-11-01' },
        { type: 'expense', amount: 3200, category: 'Food', description: 'Groceries', date: '2025-11-06' },
        { type: 'expense', amount: 2500, category: 'Utilities', description: 'Bills', date: '2025-11-10' },
        { type: 'income', amount: 45000, category: 'Salary', description: 'Monthly salary', date: '2025-10-01' },
        { type: 'expense', amount: 12000, category: 'Rent', description: 'Monthly rent', date: '2025-10-01' },
        { type: 'expense', amount: 2800, category: 'Food', description: 'Groceries', date: '2025-10-04' },
        { type: 'expense', amount: 1800, category: 'Transport', description: 'Fuel', date: '2025-10-12' },
        { type: 'income', amount: 45000, category: 'Salary', description: 'Monthly salary', date: '2025-09-01' },
        { type: 'expense', amount: 12000, category: 'Rent', description: 'Monthly rent', date: '2025-09-01' },
        { type: 'expense', amount: 3000, category: 'Food', description: 'Groceries', date: '2025-09-05' },
        { type: 'expense', amount: 1500, category: 'Entertainment', description: 'Streaming subscriptions', date: '2025-09-15' },
    ];

    for (const t of transactions) {
        runSql(
            'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, t.type, t.amount, t.category, t.description, t.date]
        );
    }

    console.log(`✅ Inserted ${transactions.length} sample transactions`);
    console.log('🎉 Seed complete!');
}

seed().catch(console.error);
