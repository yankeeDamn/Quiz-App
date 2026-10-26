'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '@/components/motion/reveal';
import { GraduationCap, Sparkles, Target, TrendingUp, Building2, Award, BookOpen, FileQuestion, ClipboardCheck, Layers3, ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { CompetitiveTopicsOverview } from '@/components/mocks/competitive-topics-overview';
import { SearchBar } from '@/components/shared/search-bar';
import { FilterChips } from '@/components/shared/filter-chips';
import { QuizCard } from '@/components/quiz/quiz-card';
import { ProviderCard } from '@/components/quiz/provider-card';
import { getUniqueSubjects, examProviders, exams, getAllQuizzes } from '@/data/quizzes';
import { fetchPracticeLibrary, applyHomepageOverrides, type PracticeLibraryData } from '@/lib/practice-overrides';
import { api } from '@/lib/api';
import { IT_CERTS } from '@/lib/it-certs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const difficultyFilters = [
  { id: 'Easy', label: 'Easy' },
  { id: 'Medium', label: 'Medium' },
  { id: 'Hard', label: 'Hard' },
];

type HomeStats = {
  bankQuestions: number;
  availableQuestions: number;
  notYetAvailable: number;
  liveTests: number;
  publishedMocks: number;
  topicTests: number;
};

const INDIA_EXAMS = [
  { name: 'SSC CGL', filter: 'SSC', blurb: 'General studies, reasoning and quantitative practice.' },
  { name: 'Banking', filter: 'Banking', blurb: 'Banking aptitude, reasoning and English preparation.' },
  { name: 'Railways', filter: 'Railways', blurb: 'Railway exam practice with scoring and explanations.' },
  { name: 'UPSC / PSC', filter: 'UPSC / PSC', blurb: 'General studies, polity, history and science.' },
  { name: 'Campus', filter: 'Placements', blurb: 'Quantitative and reasoning practice for campus recruitment.' },
];

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const [practiceLibrary, setPracticeLibrary] = useState<PracticeLibraryData>({overrides: [], additions: []});
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetchPracticeLibrary()
      .then(data => { if (mounted) setPracticeLibrary(data); })
      .catch(() => {}); // Bundled practice remains available when the API is offline.
    api<HomeStats>('/api/v1/mocks/stats', {public: true})
      .then(result => {
        if (!mounted) return;
        if (result.success && result.data) setHomeStats(result.data);
        else setStatsUnavailable(true);
      })
      .catch(() => { if (mounted) setStatsUnavailable(true); });
    return () => { mounted = false; };
  }, []);
  const allQuizzes = useMemo(
    () => getAllQuizzes().map(quiz => applyHomepageOverrides(quiz, practiceLibrary.overrides, practiceLibrary.additions)),
    [practiceLibrary]
  );

  const subjectFilters = useMemo(() => {
    const subjects = getUniqueSubjects();
    return subjects.map((s) => ({ id: s, label: s }));
  }, []);

  const uniqueHomeQuestions = useMemo(
    () => new Set(allQuizzes.flatMap(quiz => quiz.questions.map(question => question.id))).size,
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
        {/* Compact quick links; avoid crowding the mobile hero. */}
        <div className="border-b border-indigo-100/70 bg-indigo-50/70 px-4 py-2.5 text-xs dark:border-indigo-950 dark:bg-indigo-950/40">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
            <span className="font-medium text-slate-600 dark:text-slate-300">Practice quizzes · Mock tests · Skill-building</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-indigo-700 dark:text-indigo-300">
              <Link href="/certifications" className="hover:underline">IT certifications</Link>
              <Link href="/institute-admin" className="hover:underline">Institute tools</Link>
            </div>
          </div>
        </div>

        {/* Compact mobile-first hero. Stats are verified from the live catalogue. */}
        <section className="ep-hero border-b border-indigo-100/60 dark:border-slate-800">
          <div aria-hidden="true" className="ep-hero-grid" />
          <div className="container relative mx-auto px-4 py-10 sm:py-16 lg:py-20">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.4 }}
              className="mx-auto max-w-6xl"
            >
              <div className="grid items-center gap-9 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
                <div className="text-left">
                  <p className="ep-eyebrow"><Sparkles className="h-4 w-4" /> EXAMPRO · LEARN WITH CONFIDENCE</p>
                  <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                    Practice for your <span className="ep-gradient-text">next big exam.</span>
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                    Prepare for SSC, Banking, Railways and IT certifications. Choose a live test,
                    practise at your pace and learn from detailed explanations.
                  </p>
                  <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
                    <Button size="lg" className="ep-link-motion min-h-12 bg-indigo-600 px-6 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700" asChild>
                      <Link href="/india-mocks"><Target className="mr-2 h-5 w-5" /> Browse live tests <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                    <Button size="lg" variant="outline" className="ep-link-motion min-h-12 border-indigo-200 bg-white/70 px-6 dark:border-slate-700 dark:bg-slate-900/70" asChild>
                      <Link href="#quizzes"><BookOpen className="mr-2 h-5 w-5" /> Free practice quizzes</Link>
                    </Button>
                  </div>
                  <Link href="/dashboard" className="mt-5 inline-flex min-h-9 items-center gap-2 text-sm font-medium text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300">
                    <TrendingUp className="h-4 w-4" /> Track your progress in the dashboard
                  </Link>
                </div>
                <div aria-label="ExamPro content statistics">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[
                      {
                        label: 'Question bank',
                        value: homeStats?.bankQuestions.toLocaleString('en-IN') ?? '—',
                        note: homeStats ? `${homeStats.notYetAvailable.toLocaleString('en-IN')} not yet available` : 'Live database total',
                        icon: FileQuestion,
                      },
                      {
                        label: 'Live tests',
                        value: homeStats?.liveTests.toLocaleString('en-IN') ?? '—',
                        note: homeStats ? `${homeStats.publishedMocks} mocks · ${homeStats.topicTests} topic tests` : 'Published catalogue',
                        icon: ClipboardCheck,
                      },
                      {
                        label: 'Free quiz tracks',
                        value: String(allQuizzes.length),
                        note: `${uniqueHomeQuestions} distinct practice questions`,
                        icon: Layers3,
                      },
                      {
                        label: 'IT starter tracks',
                        value: String(IT_CERTS.length),
                        note: 'Azure · AWS · CompTIA',
                        icon: GraduationCap,
                      },
                    ].map(stat => (
                      <div key={stat.label} className="ep-home-stat min-w-0 rounded-2xl p-4 sm:p-5">
                        <stat.icon aria-hidden="true" className="mb-3 h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                        <div className="text-3xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">{stat.value}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{stat.label}</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400" role="status">
                    {statsUnavailable
                      ? 'Live database counts temporarily unavailable. The practice library still works.'
                      : homeStats
                        ? 'Question bank includes unpublished content; only live tests are available to students.'
                        : 'Checking the live exam catalogue…'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Discover exam categories after the main value proposition. */}
        <section className="container mx-auto px-4 py-12 sm:py-16" aria-labelledby="india-mocks-heading">
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

        <CompetitiveTopicsOverview />

        {/* Exam Providers Section */}
        <section className="border-b bg-white/60 dark:bg-background">
          <div className="container mx-auto px-4 py-12 sm:py-16">
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
                  : 'All available free practice quizzes'}
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
