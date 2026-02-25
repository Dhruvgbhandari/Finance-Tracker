# 💰 MoneyTrack

MoneyTrack is a premium personal finance tracking application designed to help you manage your income, expenses, budgets, and savings goals with a stunning, modern dark-themed interface.

![MoneyTrack Dashboard Mockup](public/img/dashboard_preview.png) *(Note: Add actual screenshot after deployment)*

## ✨ Features

- **Dashboard**: Real-time summary of your balance, income, and expenses with interactive charts.
- **Transaction Management**: Deep tracking of daily transactions with categories and descriptions.
- **Budgeting**: Set monthly category-wise budgets and track your spending progress.
- **Savings Goals**: Visualize your dreams with progress bars, icons, and deadlines.
- **Analytics**: Deep dive into your financial health with net worth charts, heatmap, and AI-driven insights.
- **Recurring Transactions**: Automate your frequent bills and salary entries.
- **Auth**: Secure session-based authentication with password hashing.
- **CSV Export**: Take your data with you anytime.

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism Design), JavaScript (ES6+)
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Backend**: Node.js, Express.js
- **Database**: [sql.js](https://github.com/sql-js/sql.js) (Pure JavaScript SQLite implementation)
- **Security**: Helmet, bcryptjs, express-validator, express-session

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd finance-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Seed the database with demo data (optional):
   ```bash
   npm run seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`.

## 📦 Deployment

MoneyTrack is ready for deployment on platforms like Render, Railway, Vercel, or Fly.io.

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-very-secure-secret-key
DB_PATH=data/moneytrack.db
```

### Docker

You can also run the application using Docker:

```bash
docker build -t moneytrack .
docker run -p 3000:3000 moneytrack
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Design inspired by Antigravity aesthetics.
- Charts powered by Chart.js.
