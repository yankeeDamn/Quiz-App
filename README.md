# Exam Practice Pro — Quiz App

A certification exam practice platform inspired by [CertyIQ](https://certyiq.com/). Features a sign-in page, timed quiz engine, score tracking, and Stripe-powered payments.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Sign-In / Guest Access** | Email + password login form with guest option. |
| ⏱️ **Countdown Timer** | Each exam session is timed (default 30 minutes). The timer turns red in the last 5 minutes and auto-submits on expiry. |
| 📋 **Quiz Engine** | Dynamic question rendering with radio-button options. |
| 🏆 **Score & Results** | Instant score calculation and percentage display after submission. |
| 🔁 **Retake** | Users can retake the quiz as many times as they like. |
| 💳 **Stripe Payments** | Secure payment flow to unlock full exam access (requires your own Stripe keys). |

---

## 🗂️ Project Structure

```
Quiz-App/
├── Index.html       # Main HTML (sign-in view + quiz view)
├── script.js        # All client-side logic (auth, timer, quiz, payment)
├── style.css        # Styling for all views
├── server.js        # Node.js + Express backend for Stripe charges
├── package.json     # Node.js dependencies
└── README.md        # This file
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or later
- A [Stripe account](https://stripe.com/) (for payment processing)

### 1. Clone the repository

```bash
git clone https://github.com/yankeeDamn/Quiz-App.git
cd Quiz-App
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Stripe API Keys

You need **two** Stripe keys — a **Publishable Key** (used in the browser) and a **Secret Key** (used on the server).

Find them in your [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys).

#### Frontend key (`script.js`, line near the bottom)

```js
// Replace the placeholder with your actual Stripe publishable key
var stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY_HERE');
```

#### Backend key (`server.js`, line 3)

```js
// Replace the placeholder with your actual Stripe secret key
const stripe = require('stripe')('sk_test_YOUR_SECRET_KEY_HERE');
```

> ⚠️ **Never commit real secret keys to source control.** Use environment variables in production:
>
> ```js
> const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
> ```

### 4. Run the server

```bash
npm start
```

The app will be available at **http://localhost:3000**.

> **Note:** The frontend files (`Index.html`, `script.js`, `style.css`) must be served from the `public/` directory by Express, or you can open `Index.html` directly in a browser for UI-only testing (payment requests will fail without the server).

---

## 🕹️ How to Use

1. Open the app in your browser.
2. **Sign in** with any email/password (demo auth accepts all credentials) or click **Continue as Guest**.
3. Answer the quiz questions before the **30-minute timer** runs out.
4. Click **Submit Quiz & Pay** (or let the timer expire) to see your score.
5. Click **Retake Quiz** to try again, or **Get Full Access** to proceed to payment.

---

## 🔧 Configuration Reference

| Setting | File | Default |
|---|---|---|
| Exam duration | `script.js` → `EXAM_DURATION_SECONDS` | `1800` (30 min) |
| Payment amount | `server.js` → `amount` | `5000` ($50.00) |
| Stripe publishable key | `script.js` | `'your-publishable-key-here'` |
| Stripe secret key | `server.js` | `'your-secret-key-here'` |

---

## 🛣️ Roadmap

- [ ] Real user authentication (JWT / OAuth)
- [ ] Database integration (MongoDB / PostgreSQL) for questions and user data
- [ ] Multiple exam categories (AWS, Azure, CompTIA, etc.)
- [ ] Score history and progress dashboard
- [ ] Question explanations and review mode
- [ ] Mobile-responsive improvements

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

---

## 📄 License

[ISC](LICENSE)

