// ============================================
// MoneyTrack — Auth Page Logic
// ============================================

(function () {
    // Check if already logged in
    fetch('/api/auth/me')
        .then(res => {
            if (res.ok) {
                window.location.href = '/dashboard.html';
            }
        })
        .catch(() => {});

    const errorMsg = document.getElementById('error-msg');

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.add('visible');
    }

    function hideError() {
        errorMsg.classList.remove('visible');
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const btn = document.getElementById('login-btn');

            if (!email || !password) {
                return showError('Please fill in all fields');
            }

            btn.disabled = true;
            btn.textContent = 'Signing in...';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Login failed');
                }

                window.location.href = '/dashboard.html';
            } catch (err) {
                showError(err.message);
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });
    }

    // Register Form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const btn = document.getElementById('register-btn');

            if (!email || !password || !confirmPassword) {
                return showError('Please fill in all fields');
            }

            if (password.length < 6) {
                return showError('Password must be at least 6 characters');
            }

            if (password !== confirmPassword) {
                return showError('Passwords do not match');
            }

            btn.disabled = true;
            btn.textContent = 'Creating account...';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Registration failed');
                }

                window.location.href = '/dashboard.html';
            } catch (err) {
                showError(err.message);
                btn.disabled = false;
                btn.textContent = 'Create Account';
            }
        });
    }
})();
