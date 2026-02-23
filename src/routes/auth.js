const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { queryOne, runSql } = require('../db/database');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { email, password } = req.body;

        // Check if user already exists
        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, 10);
        const result = runSql('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash]);

        // Auto-login after register
        req.session.userId = result.lastInsertRowid;
        req.session.email = email;

        res.status(201).json({ message: 'Account created successfully', user: { id: result.lastInsertRowid, email } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const { email, password } = req.body;

        const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        req.session.userId = user.id;
        req.session.email = user.email;

        res.json({ message: 'Logged in successfully', user: { id: user.id, email: user.email } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = queryOne('SELECT id, email, starting_balance FROM users WHERE id = ?', [req.session.userId]);
    res.json({ user: { id: user.id, email: user.email, startingBalance: user.starting_balance || 0 } });
});

// GET /api/auth/balance — get starting balance
router.get('/balance', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = queryOne('SELECT starting_balance FROM users WHERE id = ?', [req.session.userId]);
    res.json({ startingBalance: user ? (user.starting_balance || 0) : 0 });
});

// PUT /api/auth/balance — set starting balance
router.put('/balance', [
    body('startingBalance').isFloat({ min: 0 }).withMessage('Starting balance must be a non-negative number'),
], (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { startingBalance } = req.body;
    runSql('UPDATE users SET starting_balance = ? WHERE id = ?', [startingBalance, req.session.userId]);
    res.json({ message: 'Starting balance updated', startingBalance });
});

module.exports = router;
