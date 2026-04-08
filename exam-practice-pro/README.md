# Exam Practice Pro

A professional certification exam practice platform built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**, and **shadcn/ui**. Practice for cloud certifications (AWS, Azure, GCP), security exams (CompTIA), and more with timed quizzes, flashcards, bookmarks, and progress tracking.

---

## Features

### Core Quiz Engine
- **Timed & Practice Modes** — Take quizzes under exam conditions with a countdown timer, or practice at your own pace with immediate feedback
- **Multiple Question Types** — Single-choice, multiple-choice, and true/false questions
- **Question Navigation** — Jump between questions, mark for review, track answered/unanswered
- **Keyboard Shortcuts** — Navigate with arrow keys, submit with Enter, flag with `M`
- **Shuffle Options** — Randomize answer order to prevent memorization

### Authentication & User Accounts
- **Sign In with GitHub or Google** via OAuth (NextAuth.js / Auth.js)
- **Guest Mode** — Start practicing immediately without an account
- **User-Scoped Storage** — Each signed-in user gets their own progress, bookmarks, and stats isolated in localStorage
- **Session Persistence** — Stay signed in across browser sessions

### Study Tools
- **Bookmarks** — Save questions for later review; dedicated `/bookmarks` page with search
- **Personal Notes** — Add notes to any question during quizzes or review
- **Flashcard Mode** — Study questions as flip cards with progress tracking
- **Report Issues** — Flag incorrect answers, outdated info, typos, or unclear questions

### Progress & Analytics
- **Dashboard** — View total attempts, average score, streak, strongest/weakest topics
- **Performance Charts** — Visualize score history with Recharts
- **Topic Breakdown** — See accuracy per topic to identify weak areas
- **Achievement System** — 10 badges (First Steps, Perfect Score, Speed Demon, Week Warrior, etc.) with progress bars
- **Resume Quiz** — Continue an in-progress quiz from where you left off

### Certification Providers
- **Microsoft** (AZ-900 Azure Fundamentals)
- **AWS** (CLF-C02 Cloud Practitioner)
- **Google Cloud** (Cloud Digital Leader)
- **CompTIA** (Security+)
- **General** (Math, CS, Mixed quizzes)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| UI | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui 4](https://ui.shadcn.com/) |
| Auth | [NextAuth.js v5](https://authjs.dev/) (GitHub, Google, Credentials) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) with persist middleware |
| Charts | [Recharts](https://recharts.org/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Language | TypeScript 5 (strict mode) |

---

## Project Structure

```
exam-practice-pro/
├── app/                        # Next.js App Router pages
│   ├── api/auth/[...nextauth]/ # NextAuth API route
│   ├── auth/signin/            # Sign-in page (GitHub, Google, Guest)
│   ├── bookmarks/              # Bookmarked questions page
│   ├── dashboard/              # Stats & analytics dashboard
│   ├── quiz/[id]/
│   │   ├── setup/              # Quiz configuration (mode, question count)
│   │   ├── take/               # Active quiz-taking interface
│   │   ├── result/             # Score & performance results
│   │   ├── review/             # Answer review with explanations
│   │   └── flashcards/         # Flashcard study mode
│   ├── layout.tsx              # Root layout (theme, auth, tooltip providers)
│   ├── page.tsx                # Landing page with providers & quizzes
│   └── globals.css             # Global styles
├── components/
│   ├── dashboard/              # Stats cards, charts, achievement badges
│   ├── layout/                 # Header, footer, theme/auth providers
│   ├── quiz/                   # Quiz cards, question panel, timer, navigator
│   ├── results/                # Score display, topic/difficulty breakdowns
│   ├── shared/                 # Search bar, filter chips, loaders
│   └── ui/                     # shadcn/ui primitives (button, card, dialog…)
├── data/
│   └── quizzes.ts              # Question bank, exam metadata, providers
├── hooks/
│   ├── use-timer.ts            # Countdown timer hook
│   └── use-keyboard-shortcuts.ts
├── lib/
│   ├── auth.ts                 # NextAuth configuration
│   ├── storage.ts              # localStorage abstraction (user-scoped)
│   ├── quiz-utils.ts           # Scoring, shuffling, formatting helpers
│   ├── types.ts                # TypeScript interfaces
│   └── utils.ts                # cn() utility
├── store/
│   └── quiz-store.ts           # Zustand store (quiz state, session, settings)
├── types/
│   └── next-auth.d.ts          # NextAuth type augmentation
├── .env.example                # Environment variables template
└── package.json
```

---

## Getting Started

### Prerequisites
- **Node.js** 18.17 or later
- **npm** 9+ (or pnpm/yarn)

### Installation

```bash
# Clone the repository
git clone https://github.com/yankeeDamn/Quiz-App.git
cd Quiz-App/exam-practice-pro

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Edit `.env.local` with your credentials:

```env
# Required — generate with: openssl rand -base64 32
AUTH_SECRET="your-random-secret"

# Optional — GitHub OAuth (https://github.com/settings/developers)
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# Optional — Google OAuth (https://console.cloud.google.com/apis/credentials)
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

> **Note:** OAuth providers are optional. The app works with Guest mode only if no OAuth credentials are configured.

#### Setting Up GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set **Homepage URL** to `http://localhost:3000`
4. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`
5. Copy the Client ID and generate a Client Secret

#### Setting Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:3000` to Authorized JavaScript origins
4. Add `http://localhost:3000/api/auth/callback/google` to Authorized redirect URIs
5. Copy the Client ID and Client Secret

### Running the App

```bash
# Development server (with Turbopack)
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

The app will be available at **http://localhost:3000**.

---

## How It Works

### Quiz Flow
1. **Browse** → Landing page shows certification providers and available exams
2. **Configure** → Select quiz mode (Timed/Practice), number of questions, time limit
3. **Take** → Answer questions with timer, navigation panel, bookmark/note/report actions
4. **Results** → View score, time taken, difficulty breakdown, topic performance
5. **Review** → Go through each answer with explanations, filter by correct/incorrect/skipped

### Authentication Flow
- NextAuth.js v5 with JWT strategy (no database required)
- GitHub and Google OAuth providers for persistent accounts
- Guest mode via Credentials provider (generates a unique session ID)
- `UserStorageProvider` scopes all localStorage keys by user ID hash

### Data Persistence
- All user data is stored in **localStorage** with keys scoped to the signed-in user
- Anonymous (not signed in) users share a common storage scope
- Zustand store persists active quiz sessions across page refreshes
- Quiz history (last 50 results), bookmarks, notes, achievements, and dashboard stats are all persisted

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next question |
| `M` | Toggle mark for review |
| `A`–`D` | Select answer option |
| `Ctrl+Enter` | Submit quiz |

---

## Adding New Questions

Questions are defined in `data/quizzes.ts`. Add to the `questions` array:

```typescript
{
  id: 'unique-id',
  question: 'What is the purpose of a VPC in cloud computing?',
  options: [
    { id: 'a', text: 'Virtual Private Cloud for network isolation' },
    { id: 'b', text: 'A type of virtual machine' },
    { id: 'c', text: 'A storage service' },
    { id: 'd', text: 'A DNS service' },
  ],
  correctAnswers: ['a'],
  explanation: 'A VPC provides logically isolated network...',
  difficulty: 'Medium',
  topic: 'Networking',
  subject: 'Cloud Computing',
  type: 'single-choice',
}
```

Then reference the question IDs in a quiz or exam definition in the same file.

### Adding a New Exam Provider

1. Add the provider to `examProviders` array in `data/quizzes.ts`
2. Create questions with the relevant subject/topic
3. Create an `ExamMeta` entry in the `exams` array linking to your provider

---

## localStorage Keys

Keys are automatically prefixed with a user hash when signed in (e.g., `u_abc123_exam-practice-results`).

| Base Key | Description |
|----------|-------------|
| `exam-practice-session-{id}` | In-progress quiz session |
| `exam-practice-results` | Quiz history (last 50 results) |
| `exam-practice-dashboard-stats` | Aggregate performance statistics |
| `exam-practice-bookmarks` | Bookmarked question IDs |
| `exam-practice-notes` | Personal notes per question |
| `exam-practice-reports` | Reported question issues |
| `exam-practice-achievements` | Achievement progress and unlock dates |

---

## Accessibility

- Full keyboard navigation support
- ARIA labels on all interactive elements
- Screen reader announcements for timer warnings
- Focus management in dialogs and modals
- High contrast support in dark mode

## Browser Support

- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Create optimized production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

---

## License

This project is for educational purposes.
