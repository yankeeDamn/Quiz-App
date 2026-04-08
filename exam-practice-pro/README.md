# Exam Practice Pro

A professional exam practice application built with Next.js 16, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Quiz Selection**: Browse available quizzes with search and filtering
- **Customizable Setup**: Configure question count, difficulty, timer, and shuffle options
- **Two Modes**: Practice mode with immediate feedback, or Exam mode for realistic simulation
- **Real-time Timer**: Countdown with pause/resume and warning states
- **Question Navigation**: Visual grid showing answered, marked, and current questions
- **Keyboard Shortcuts**: Arrow keys, M for mark, A-D for answers, Ctrl+Enter to submit
- **Detailed Results**: Score breakdown by topic and difficulty with charts
- **Review Mode**: Filter and review all answers with explanations
- **Dashboard**: Track progress, streaks, and performance over time
- **Dark/Light Mode**: System-aware theme switching
- **Fully Accessible**: ARIA labels, keyboard navigation, screen reader support
- **Offline-First**: All data persisted to localStorage

## Tech Stack

- **Framework**: Next.js 16.2 (App Router + Turbopack)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Components**: shadcn/ui (base-ui based)
- **State**: Zustand with persist middleware
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Theming**: next-themes

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

\`\`\`bash
# Navigate to the project directory
cd exam-practice-pro

# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

\`\`\`bash
# Create production build
npm run build

# Start production server
npm start
\`\`\`

## Project Structure

\`\`\`
exam-practice-pro/
├── app/                      # Next.js App Router pages
│   ├── page.tsx             # Landing page with quiz list
│   ├── layout.tsx           # Root layout with providers
│   ├── globals.css          # Global styles
│   ├── dashboard/           # Performance dashboard
│   └── quiz/[id]/
│       ├── setup/           # Quiz configuration
│       ├── take/            # Exam interface
│       ├── result/          # Score and statistics
│       └── review/          # Answer review
├── components/
│   ├── layout/              # Header, Footer, ThemeProvider
│   ├── quiz/                # Quiz-specific components
│   ├── results/             # Score display, breakdowns
│   ├── dashboard/           # Stats cards, charts
│   ├── shared/              # Reusable components
│   └── ui/                  # shadcn/ui components
├── data/
│   └── quizzes.ts           # Demo quiz data (18 questions)
├── hooks/
│   ├── use-timer.ts         # Timer with pause/resume
│   └── use-keyboard-shortcuts.ts
├── lib/
│   ├── types.ts             # TypeScript interfaces
│   ├── quiz-utils.ts        # Scoring, formatting, helpers
│   ├── storage.ts           # localStorage abstraction
│   └── utils.ts             # cn() helper
└── store/
    └── quiz-store.ts        # Zustand global state
\`\`\`

## Demo Data

The app includes 18 demo questions across two subjects:

- **Mathematics**: Algebra, Geometry, Arithmetic, Statistics
- **Computer Science**: Programming, Data Structures, Algorithms, Networking

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| \`←\` / \`→\` | Previous / Next question |
| \`M\` | Toggle mark for review |
| \`A-D\` | Select answer option |
| \`Ctrl+Enter\` | Submit quiz |

## localStorage Keys

| Key | Description |
|-----|-------------|
| \`exam-practice-session-{id}\` | In-progress quiz session |
| \`exam-practice-results\` | Quiz history (last 50) |
| \`exam-practice-dashboard-stats\` | Aggregate performance stats |

## Customization

### Adding New Quizzes

Edit \`data/quizzes.ts\` to add new questions and quizzes:

\`\`\`typescript
const newQuestion: Question = {
  id: 'unique-id',
  text: 'Question text here?',
  type: 'single', // 'single' | 'multiple' | 'true-false'
  options: [
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
  ],
  correctAnswers: ['a'],
  explanation: 'Explanation text',
  difficulty: 'Medium',
  subject: 'Subject Name',
  topic: 'Topic Name',
};
\`\`\`

### Theming

The app uses CSS variables for theming. Edit \`app/globals.css\` to customize colors.

## Development Scripts

\`\`\`bash
npm run dev      # Start dev server with Turbopack
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
\`\`\`

## Accessibility

- Full keyboard navigation support
- ARIA labels on interactive elements
- Screen reader announcements for timer
- Focus management in dialogs
- High contrast color support in dark mode

## Browser Support

- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT
