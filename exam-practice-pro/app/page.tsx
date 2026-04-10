'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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

export default function HomePage() {
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
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-background dark:to-background">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiM2MzY2ZjEiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-50" />

          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl text-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
              >
                <Sparkles className="h-4 w-4" />
                Professional Exam Practice Platform
              </motion.div>

              <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Exam Practice
                </span>{' '}
                Pro
              </h1>

              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                Practice smarter. Score higher. Master your exams with our
                comprehensive quiz platform.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  asChild
                >
                  <Link href="#quizzes">
                    <Target className="mr-2 h-5 w-5" />
                    Start Practicing
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/dashboard">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    View Dashboard
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-6"
            >
              {[
                { label: 'Questions', value: `${totalQuestions}+` },
                { label: 'Exams', value: String(allQuizzes.length) },
                { label: 'Providers', value: String(examProviders.length) },
                { label: 'Quiz Modes', value: '2' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
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

        {/* Exam Providers Section */}
        <section className="border-b bg-white dark:bg-background">
          <div className="container mx-auto px-4 py-12">
            <div className="mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6 text-indigo-600" />
                Certification Providers
              </h2>
              <p className="text-muted-foreground mt-1">
                Prepare for industry-leading certifications
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
