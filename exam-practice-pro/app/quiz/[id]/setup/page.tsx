'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  FileQuestion,
  Play,
  Settings2,
  Shuffle,
  BookOpen,
  Target,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getAnyQuizById } from '@/data/quizzes';
import { useQuizStore } from '@/store/quiz-store';
import { QuizSettings, DEFAULT_QUIZ_SETTINGS, Difficulty } from '@/lib/types';
import { formatDuration, getDifficultyColor } from '@/lib/quiz-utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizSetupPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const quiz = getAnyQuizById(id);
  const { startQuiz, session, restoreSession } = useQuizStore();

  const [settings, setSettings] = useState<QuizSettings>({
    ...DEFAULT_QUIZ_SETTINGS,
    questionCount: quiz?.questionCount || 10,
    timeLimit: quiz?.duration || 30,
  });
  const [hasExistingSession, setHasExistingSession] = useState(false);

  useEffect(() => {
    if (quiz && session?.quizId === quiz.id && !session.endTime) {
      setHasExistingSession(true);
    }
  }, [quiz, session]);

  const handleStartQuiz = () => {
    if (!quiz) return;
    startQuiz(quiz.id, settings);
    router.push(`/quiz/${quiz.id}/take`);
  };

  const handleContinueQuiz = () => {
    if (!quiz) return;
    router.push(`/quiz/${quiz.id}/take`);
  };

  if (!quiz) {
    return (
      <>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Quiz not found</h1>
            <p className="text-muted-foreground mt-2">
              The quiz you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild className="mt-4">
              <Link href="/">Go back home</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const maxQuestions = quiz.questionCount;

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quizzes
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Quiz Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-1"
            >
              <Card className="sticky top-24">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{quiz.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {quiz.subject}
                      </p>
                    </div>
                  </div>
                  <Badge className={getDifficultyColor(quiz.difficulty)}>
                    {quiz.difficulty}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {quiz.description}
                  </p>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileQuestion className="h-4 w-4 text-muted-foreground" />
                      <span>{quiz.questionCount} questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDuration(quiz.duration)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {quiz.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {hasExistingSession && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        You have an unfinished session
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Continue where you left off or start fresh.
                      </p>
                      <Button
                        size="sm"
                        className="mt-3 w-full bg-yellow-600 hover:bg-yellow-700"
                        onClick={handleContinueQuiz}
                      >
                        Continue Quiz
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Settings Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Quiz Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Mode Selection */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Quiz Mode</Label>
                    <RadioGroup
                      value={settings.mode}
                      onValueChange={(value: 'practice' | 'exam') =>
                        setSettings({ ...settings, mode: value })
                      }
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <Label
                        htmlFor="practice"
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all ${
                          settings.mode === 'practice'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30'
                            : 'border-muted hover:border-indigo-300'
                        }`}
                      >
                        <RadioGroupItem value="practice" id="practice" className="mt-1" />
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            <BookOpen className="h-4 w-4" />
                            Practice Mode
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Learn as you go. See explanations after each answer.
                          </p>
                        </div>
                      </Label>
                      <Label
                        htmlFor="exam"
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all ${
                          settings.mode === 'exam'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30'
                            : 'border-muted hover:border-indigo-300'
                        }`}
                      >
                        <RadioGroupItem value="exam" id="exam" className="mt-1" />
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            <Target className="h-4 w-4" />
                            Exam Mode
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Simulate real exam. Results shown only at the end.
                          </p>
                        </div>
                      </Label>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Number of Questions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        Number of Questions
                      </Label>
                      <span className="font-mono text-lg font-bold text-indigo-600">
                        {settings.questionCount}
                      </span>
                    </div>
                    <Slider
                      value={[settings.questionCount]}
                      onValueChange={(value) => {
                        const val = Array.isArray(value) ? value[0] : value;
                        setSettings({ ...settings, questionCount: val });
                      }}
                      min={1}
                      max={maxQuestions}
                      step={1}
                      className="py-4"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum available: {maxQuestions} questions
                    </p>
                  </div>

                  {/* Difficulty Filter */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">
                      Difficulty Filter
                    </Label>
                    <Select
                      value={settings.difficulty}
                      onValueChange={(value) => {
                        if (value) {
                          setSettings({ ...settings, difficulty: value as Difficulty | 'all' });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Difficulties</SelectItem>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Timer Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold">
                          Timed Mode
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Add time pressure to your practice
                        </p>
                      </div>
                      <Switch
                        checked={settings.timed}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, timed: checked })
                        }
                      />
                    </div>
                    {settings.timed && (
                      <div className="mt-4 space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label>Time Limit</Label>
                          <span className="font-mono font-bold">
                            {formatDuration(settings.timeLimit)}
                          </span>
                        </div>
                        <Slider
                          value={[settings.timeLimit]}
                          onValueChange={(value) => {
                            const val = Array.isArray(value) ? value[0] : value;
                            setSettings({ ...settings, timeLimit: val });
                          }}
                          min={5}
                          max={120}
                          step={5}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Shuffle Options */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Shuffle className="h-4 w-4" />
                      Randomization
                    </Label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Shuffle Questions</Label>
                          <p className="text-sm text-muted-foreground">
                            Randomize question order
                          </p>
                        </div>
                        <Switch
                          checked={settings.shuffleQuestions}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, shuffleQuestions: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Shuffle Answer Options</Label>
                          <p className="text-sm text-muted-foreground">
                            Randomize answer choices
                          </p>
                        </div>
                        <Switch
                          checked={settings.shuffleAnswers}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, shuffleAnswers: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Start Button */}
                  <div className="pt-4 space-y-3">
                    <Button
                      size="lg"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-lg h-14"
                      onClick={handleStartQuiz}
                    >
                      <Play className="mr-2 h-5 w-5" />
                      Begin Test
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full h-12"
                      asChild
                    >
                      <Link href={`/quiz/${id}/flashcards`}>
                        <Layers className="mr-2 h-5 w-5" />
                        Study with Flashcards
                      </Link>
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-3">
                      Your progress will be automatically saved
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
