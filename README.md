# Exam Practice Pro — Quiz App

A certification exam practice platform inspired by [CertyIQ](https://certyiq.com/). Features a sign-in page, timed quiz engine, score tracking, and Stripe-powered payments.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Sign-In / Guest Access** | Email + password login form with guest option. JWT-based auth with role support. |
| ⏱️ **Countdown Timer** | Each exam session is timed (default 30 minutes). The timer turns red in the last 5 minutes and auto-submits on expiry. |
| 📋 **Quiz Engine** | Dynamic question rendering with radio-button options. |
| 🏆 **Score & Results** | Instant score calculation and percentage display after submission. |
| 🔁 **Retake** | Users can retake the quiz as many times as they like. |
| 💳 **Stripe Payments** | Secure payment flow using the Payment Intents API with webhook verification. |
| 🛡️ **Security** | Helmet headers, CORS, rate limiting, input validation, env-based config. |

---

## 🏗️ Backend Architecture

```
Quiz-App/
├── src/                          # ← Production backend
│   ├── server.js                 #    Entry point — starts Express, graceful shutdown
│   ├── app.js                    #    Express app setup (middleware, routes)
│   ├── config/
│   │   └── index.js              #    Centralised env-based configuration
│   ├── routes/
│   │   ├── index.js              #    Route aggregator (API v1)
│   │   ├── health.js             #    GET /api/v1/health
│   │   ├── payment.js            #    Payment routes (create-payment-intent, status)
│   │   └── auth.js               #    Auth routes (register, login, guest, me)
│   ├── controllers/
│   │   ├── payment.controller.js #    Payment request handlers
│   │   └── auth.controller.js    #    Auth request handlers
│   ├── services/
│   │   ├── stripe.service.js     #    Stripe Payment Intents + webhook logic
│   │   └── auth.service.js       #    JWT signing, guest sessions, password hashing
│   ├── middleware/
│   │   ├── error-handler.js      #    Centralised error + 404 handler
│   │   ├── rate-limiter.js       #    Rate limiters (general, payment, auth)
│   │   ├── auth.js               #    JWT verification, guest pass-through, RBAC
│   │   └── validate.js           #    express-validator result checker
│   ├── models/
│   │   └── schemas.js            #    PostgreSQL schema definitions (reference)
│   └── utils/
│       └── logger.js             #    Pino structured logger
├── public/                       # ← Static frontend (served by Express)
│   ├── Index.html
│   ├── script.js
│   └── style.css
├── exam-practice-pro/            # ← Next.js frontend (separate deployment)
├── .env.example                  #    Environment variable reference
├── Dockerfile                    #    Production container
├── docker-compose.yml            #    Local dev stack
├── render.yaml                   #    Render deployment config
└── .github/workflows/ci.yml     #    CI/CD pipeline
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
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

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
NODE_ENV=development
PORT=3000

# Stripe — get keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-random-secret

CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=info
```

### 4. Run the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The app will be available at **http://localhost:3000**.

---

## 🔑 Environment Variable Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | No | Environment mode | `development`, `production` |
| `PORT` | No | Server port (default: 3000) | `3000` |
| `STRIPE_SECRET_KEY` | **Yes (prod)** | Stripe secret key | `sk_test_...` or `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | **Yes (prod)** | Stripe publishable key | `pk_test_...` or `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | **Yes (prod)** | Stripe webhook signing secret | `whsec_...` |
| `JWT_SECRET` | **Yes (prod)** | Secret for JWT signing | Random 64-byte hex string |
| `JWT_EXPIRES_IN` | No | JWT expiration (default: 24h) | `24h`, `7d` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins | `https://example.com` |
| `LOG_LEVEL` | No | Pino log level (default: info) | `debug`, `info`, `warn` |

---

## 💳 Stripe Setup

### Test vs Live Mode

| | Test Mode | Live Mode |
|---|---|---|
| **Keys** | `sk_test_...` / `pk_test_...` | `sk_live_...` / `pk_live_...` |
| **Dashboard** | Toggle "Test mode" in Stripe Dashboard | Default view |
| **Cards** | Use `4242 4242 4242 4242` | Real cards |
| **Webhooks** | Use Stripe CLI for local testing | Configure in Dashboard |

### Setting Up Webhooks

1. **Local development** — use [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/payments/webhook
   ```
   Copy the webhook signing secret (`whsec_...`) to your `.env` file.

2. **Production** — create a webhook endpoint in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks):
   - URL: `https://your-domain.com/api/v1/payments/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the signing secret to your environment variables.

### Payment Flow

```
Client                         Server                         Stripe
  │                              │                              │
  ├─ GET /api/v1/payments/config ──►                            │
  │◄── { publishableKey } ──────┤                              │
  │                              │                              │
  ├─ POST /create-payment-intent ──►                            │
  │                              ├── stripe.paymentIntents.create ──►
  │                              │◄── { clientSecret } ─────────┤
  │◄── { clientSecret } ────────┤                              │
  │                              │                              │
  ├─ stripe.confirmCardPayment(clientSecret) ──────────────────►│
  │◄── { paymentIntent: succeeded } ───────────────────────────┤
  │                              │                              │
  │                              │◄── webhook: payment_intent.succeeded
  │                              ├── verify signature            │
  │                              ├── update user status          │
  │                              ├── 200 OK ────────────────────►│
```

---

## 📡 API Endpoint Documentation

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Redirects to `/api/v1/health` |
| `GET` | `/api/v1/health` | Returns server status, uptime, version |

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None | Register with email + password (min 8 chars) |
| `POST` | `/api/v1/auth/login` | None | Login with email + password, returns JWT |
| `POST` | `/api/v1/auth/guest` | None | Create a guest session with limited access |
| `GET` | `/api/v1/auth/me` | Optional | Get current user profile |

### Payments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/payments/config` | None | Get Stripe publishable key + amount |
| `POST` | `/api/v1/payments/create-payment-intent` | Optional | Create a PaymentIntent (server-authoritative amount) |
| `GET` | `/api/v1/payments/status/:id` | None | Check PaymentIntent status |
| `POST` | `/api/v1/payments/webhook` | Stripe Sig | Stripe webhook (raw body, signature verified) |

---

## 🐳 Deployment

### Docker

```bash
# Build the image
docker build -t exam-practice-pro-api .

# Run with env vars
docker run -d \
  --name exam-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e STRIPE_SECRET_KEY=sk_live_... \
  -e STRIPE_PUBLISHABLE_KEY=pk_live_... \
  -e STRIPE_WEBHOOK_SECRET=whsec_... \
  -e JWT_SECRET=$(openssl rand -hex 64) \
  -e CORS_ORIGINS=https://your-domain.com \
  exam-practice-pro-api
```

### Docker Compose (Local Development)

```bash
cp .env.example .env
# Edit .env with your values
docker compose up --build
```

### Platform Deployments

#### Render

The included `render.yaml` configures both the API and Next.js frontend.
Set the required environment variables in the Render dashboard.

#### AWS (ECS / App Runner)

1. Push Docker image to ECR
2. Create an ECS service or App Runner service
3. Set environment variables in task definition / service config
4. Point your domain to the load balancer

#### Azure (App Service / Container Instances)

1. Push Docker image to ACR
2. Create a Web App for Containers
3. Set environment variables in App Settings
4. Configure custom domain + SSL

#### Railway / Fly.io

```bash
# Railway
railway link
railway up

# Fly.io
fly launch
fly secrets set STRIPE_SECRET_KEY=sk_live_... JWT_SECRET=...
fly deploy
```

### Environment Separation

| Environment | `NODE_ENV` | Stripe Keys | Database |
|---|---|---|---|
| Development | `development` | `sk_test_...` | Local / SQLite |
| Staging | `staging` | `sk_test_...` | Staging DB |
| Production | `production` | `sk_live_...` | Production DB |

---

## 🔒 Security Features

| Feature | Implementation | OWASP Reference |
|---|---|---|
| No hardcoded secrets | All secrets via `process.env` | A02:2021 – Cryptographic Failures |
| Input validation | `express-validator` middleware | A03:2021 – Injection |
| HTTP security headers | `helmet` middleware | A05:2021 – Security Misconfiguration |
| CORS configuration | Allowlist-based `cors` | A01:2021 – Broken Access Control |
| Rate limiting | `express-rate-limit` (general + payment + auth) | A04:2021 – Insecure Design |
| Server-side amount validation | Stripe service validates against catalog | A04:2021 – Insecure Design |
| Webhook signature verification | `stripe.webhooks.constructEvent()` | A08:2021 – Software Integrity Failures |
| JWT authentication | `jsonwebtoken` with configurable secret + expiry | A07:2021 – Auth Failures |
| Password hashing | `bcryptjs` with salt rounds=12 | A02:2021 – Cryptographic Failures |
| Structured logging | Pino — no secrets logged | A09:2021 – Logging Failures |
| Graceful shutdown | SIGTERM/SIGINT handlers | Operational security |

---

## 🛣️ Roadmap

- [x] Modular backend architecture (routes, controllers, services)
- [x] Stripe Payment Intents API with webhook support
- [x] Security hardening (helmet, CORS, rate limiting, validation)
- [x] JWT-based authentication with guest support
- [x] Database schema design (PostgreSQL)
- [x] Health check, API versioning, structured logging
- [x] Dockerfile, docker-compose, CI/CD pipeline
- [ ] Real database integration (PostgreSQL / Prisma)
- [ ] OAuth providers (Google, GitHub)
- [ ] Multiple exam categories (AWS, Azure, CompTIA, etc.)
- [ ] Score history and progress dashboard API
- [ ] Question explanations and review mode API
- [ ] Admin panel for quiz management

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

---

## 📄 License

[ISC](LICENSE)

