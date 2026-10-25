'use client';

import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '@/components/motion/reveal';
import { GraduationCap, Sparkles, Target, TrendingUp, Building2, Award } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SearchBar } from '@/components/shared/search-bar';
import { FilterChips } from '@/components/shared/filter-chips';
import { QuizCard } from '@/components/quiz/quiz-card';
import { ProviderCard } from '@/components/quiz/provider-card';
import { quizzes, getUniqueSubjects, examProviders, exams, getAllQuizzes } from '@/data/quizzes';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const difficultyFilters = [
  { id: 'Easy', label: 'Easy' },
  { id: 'Medium', label: 'Medium' },
  { id: 'Hard', label: 'Hard' },
];

const INDIA_EXAMS = [
  { name: 'SSC CGL', filter: 'SSC', blurb: '2 full mocks. Reasoning, quant, English and GK.' },
  { name: 'Banking', filter: 'Banking', blurb: '2 Bank PO prelims mocks with sectional timing.' },
  { name: 'Railways', filter: 'Railways', blurb: '2 RRB NTPC CBT-1 mocks with 1/3 negative marking.' },
  { name: 'UPSC / PSC', filter: 'UPSC / PSC', blurb: '2 general studies mini mocks on polity, history and science.' },
  { name: 'Campus', filter: 'Placements', blurb: '3 aptitude tests for placement drives.' },
];

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const allQuizzes = useMemo(() => getAllQuizzes(), []);

  const subjectFilters = useMemo(() => {
    const subjects = getUniqueSubjects();
    return subjects.map((s) => ({ id: s, label: s }));
  }, []);

  const totalQuestions = useMemo(
    () => allQuizzes.reduce((sum, q) => sum + q.questions.length, 0),
    [allQuizzes]
  );

  const filteredQuizzes = useMemo(() => {
    return allQuizzes.filter((quiz) => {
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          quiz.title.toLowerCase().includes(searchLower) ||
          quiz.description.toLowerCase().includes(searchLower) ||
          quiz.subject.toLowerCase().includes(searchLower) ||
          quiz.tags.some((tag) => tag.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      if (selectedSubjects.length > 0) {
        if (
          !selectedSubjects.includes(quiz.subject) &&
          !(quiz.subject === 'Mixed' && selectedSubjects.length > 0)
        ) {
          return false;
        }
      }

      if (selectedDifficulties.length > 0) {
        if (!selectedDifficulties.includes(quiz.difficulty)) {
          return false;
        }
      }

      if (selectedProvider) {
        const exam = exams.find((e) => e.id === quiz.id);
        if (exam) {
          if (exam.provider !== selectedProvider) return false;
        } else {
          // Legacy quiz — only show when "general" provider is selected
          if (selectedProvider !== 'general') return false;
        }
      }

      return true;
    });
  }, [search, selectedSubjects, selectedDifficulties, selectedProvider, allQuizzes]);

  const toggleSubject = (id: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleDifficulty = (id: string) => {
    setSelectedDifficulties((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  const clearProviderFilter = () => {
    setSelectedProvider(null);
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-b border-indigo-100/70 bg-indigo-50/80 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-200">New: 21 India mock tests with explanations, plus doubts answered on WhatsApp</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">White-label mock tests for coaching institutes</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Link href="/institute-admin" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:flex-none">Institute Dashboard (Preview) →</Link>
              <Link href="/certifications" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-orange-600 px-5 py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 sm:flex-none">IT Certifications →</Link>
              <Link href="/india-mocks" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:flex-none">Explore Indian Mock Tests →</Link>
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="ep-hero relative overflow-hidden">
          <div aria-hidden="true" className="ep-hero-grid" />
          <div aria-hidden="true" className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiM2MzY2ZjEiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-50" />

          <div className="container relative mx-auto px-4 py-20 md:py-28">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5 }}
              className="mx-auto max-w-3xl text-center"
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.1, duration: reduceMotion ? 0 : 0.35 }}
                className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm dark:border-indigo-700/50 dark:bg-indigo-950/70 dark:text-indigo-200"
              >
                <Sparkles className="h-4 w-4" />
                Modern exam preparation, built for you
              </motion.div>

              <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                <span className="ep-gradient-text">ExamPro</span>
              </h1>

              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                Discover mock tests, build confidence, and track your progress in one focused learning space.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="ep-link-motion bg-indigo-600 px-7 shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-indigo-500/30"
                  asChild
                >
                  <Link href="#quizzes">
                    <Target className="mr-2 h-5 w-5" />
                    Start Practicing
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="ep-link-motion border-indigo-200 bg-white/70 dark:border-indigo-700 dark:bg-slate-900/70">
                  <Link href="/dashboard">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    View Dashboard
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.3, duration: reduceMotion ? 0 : 0.5 }}
              className="mx-auto mt-14 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { label: 'Questions', value: `${totalQuestions}+` },
                { label: 'Exams', value: String(allQuizzes.length) },
                { label: 'Providers', value: String(examProviders.length) },
                { label: 'Quiz Modes', value: '2' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/65 px-3 py-5 text-center shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/65">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-3xl">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Discover exam categories after the main value proposition. */}
        <section className="container mx-auto px-4 py-16" aria-labelledby="india-mocks-heading">
          <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ep-eyebrow">INDIA EXAM PRACTICE</p>
              <h2 id="india-mocks-heading" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Prepare for India&apos;s top exams</h2>
              <p className="mt-2 text-muted-foreground">Full mocks with sections, timers and negative marking, plus short topic tests.</p>
            </div>
            <Link href="/india-mocks" className="font-semibold text-blue-700 hover:underline dark:text-blue-400">See all tests →</Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {INDIA_EXAMS.map((exam) => (
              <Link key={exam.filter} href={'/india-mocks?exam=' + encodeURIComponent(exam.filter)} className="ep-card group flex h-full flex-col rounded-2xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                <span aria-hidden="true" className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"><GraduationCap className="h-5 w-5" /></span>
                <h3 className="font-semibold">{exam.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{exam.blurb}</p>
                <span className="mt-auto inline-block pt-5 text-sm font-semibold text-indigo-700 transition-colors group-hover:text-indigo-600 dark:text-indigo-300">View tests →</span>
              </Link>
            ))}
          </div>
          </Reveal>
        </section>

        {/* Exam Providers Section */}
        <section className="border-b bg-white/60 dark:bg-background">
          <div className="container mx-auto px-4 py-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6 text-indigo-600" />
                Certification Providers
              </h2>
              <p className="text-muted-foreground mt-1">
                Prepare for industry-leading certifications
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {examProviders.map((provider, index) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  examCount={exams.filter((e) => e.provider === provider.id).length}
                  onClick={() => handleProviderSelect(provider.id)}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Quizzes Section */}
        <section id="quizzes" className="container mx-auto px-4 py-12">
          {/* Section Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Award className="h-6 w-6 text-indigo-600" />
                Practice Exams
              </h2>
              <p className="text-muted-foreground mt-1">
                {selectedProvider
                  ? `Showing exams from ${examProviders.find((p) => p.id === selectedProvider)?.name || 'selected provider'}`
                  : 'All available practice exams'}
              </p>
            </div>
            {selectedProvider && (
              <Button variant="outline" size="sm" onClick={clearProviderFilter}>
                Clear Provider Filter
              </Button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by title, subject, or topic..."
              className="max-w-md"
            />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Subject:
                </span>
                <FilterChips
                  chips={subjectFilters}
                  selectedIds={selectedSubjects}
                  onToggle={toggleSubject}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Difficulty:
                </span>
                <FilterChips
                  chips={difficultyFilters}
                  selectedIds={selectedDifficulties}
                  onToggle={toggleDifficulty}
                />
              </div>
            </div>
          </div>

          {/* Quiz Grid */}
          {filteredQuizzes.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No quizzes found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
