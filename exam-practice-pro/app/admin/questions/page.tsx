'use client';

import { useEffect, useState } from 'react';
import {
  getAdminQuestions,
  createAdminQuestion,
  updateAdminQuestion,
  deleteAdminQuestion,
  type AdminQuestion,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EMPTY_FORM = {
  quizId: '',
  subject: '',
  topic: '',
  difficulty: 'Medium',
  type: 'single',
  questionText: '',
  optionsRaw: 'A) \nB) \nC) \nD) ',
  correctAnswers: '',
  explanation: '',
};

type FormState = typeof EMPTY_FORM;

function parseOptions(raw: string) {
  return raw
    .split('\n')
    .map((line, i) => {
      const trimmed = line.replace(/^[A-Z]\)\s*/, '').trim();
      return { id: String.fromCharCode(97 + i), text: trimmed };
    })
    .filter((o) => o.text);
}

function QuestionForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AdminQuestion;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return EMPTY_FORM;
    const optionsRaw = initial.options
      .map((o, i) => `${String.fromCharCode(65 + i)}) ${o.text}`)
      .join('\n');
    return {
      quizId: initial.quiz_id,
      subject: initial.subject,
      topic: initial.topic,
      difficulty: initial.difficulty,
      type: initial.type,
      questionText: initial.question_text,
      optionsRaw,
      correctAnswers: initial.correct_answers.join(', '),
      explanation: initial.explanation,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const options = parseOptions(form.optionsRaw);
    const correctAnswers = form.correctAnswers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      quizId: form.quizId,
      subject: form.subject,
      topic: form.topic,
      difficulty: form.difficulty,
      type: form.type,
      questionText: form.questionText,
      options,
      correctAnswers,
      explanation: form.explanation,
    };

    const res = initial
      ? await updateAdminQuestion(initial.id, payload)
      : await createAdminQuestion(payload);

    if (res.success) {
      onSaved();
    } else {
      setError(res.error?.message ?? 'Failed to save question');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Quiz / Course ID *</Label>
          <Input
            value={form.quizId}
            onChange={(e) => set('quizId', e.target.value)}
            placeholder="e.g. az-900"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Subject *</Label>
          <Input
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="e.g. Azure Fundamentals"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Topic *</Label>
          <Input
            value={form.topic}
            onChange={(e) => set('topic', e.target.value)}
            placeholder="e.g. Cloud Concepts"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => set('difficulty', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => set('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single choice</SelectItem>
              <SelectItem value="multiple">Multiple choice</SelectItem>
              <SelectItem value="true-false">True / False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Question text *</Label>
        <Textarea
          value={form.questionText}
          onChange={(e) => set('questionText', e.target.value)}
          rows={3}
          required
        />
      </div>

      <div className="space-y-1">
        <Label>
          Options (one per line, e.g. <code className="text-xs">A) text</code>)
        </Label>
        <Textarea
          value={form.optionsRaw}
          onChange={(e) => set('optionsRaw', e.target.value)}
          rows={4}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label>
          Correct answer IDs (comma-separated, e.g. <code className="text-xs">a</code> or{' '}
          <code className="text-xs">a, c</code>)
        </Label>
        <Input
          value={form.correctAnswers}
          onChange={(e) => set('correctAnswers', e.target.value)}
          placeholder="a"
          required
        />
      </div>

      <div className="space-y-1">
        <Label>Explanation</Label>
        <Textarea
          value={form.explanation}
          onChange={(e) => set('explanation', e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Question'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadQuestions() {
    setLoading(true);
    const res = await getAdminQuestions({ topic: search || undefined });
    if (res.success && res.data) {
      setQuestions(res.data.questions);
      setTotal(res.data.total);
    } else {
      setError(res.error?.message ?? 'Failed to load questions');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this question?')) return;
    setDeleting(id);
    const res = await deleteAdminQuestion(id);
    if (res.success) {
      setQuestions((q) => q.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    }
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-muted-foreground mt-1">{total} total</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Filter by topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={loadQuestions}>
          Search
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No questions yet. Click &quot;Add Question&quot; to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Question</th>
                    <th className="pb-2 text-left font-medium">Subject / Topic</th>
                    <th className="pb-2 text-left font-medium">Difficulty</th>
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td className="py-3 max-w-sm">
                        <p className="line-clamp-2">{q.question_text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{q.quiz_id}</p>
                      </td>
                      <td className="py-3">
                        <div className="font-medium">{q.subject}</div>
                        <div className="text-xs text-muted-foreground">{q.topic}</div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            q.difficulty === 'Easy'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : q.difficulty === 'Hard'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditing(q)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700"
                            disabled={deleting === q.id}
                            onClick={() => handleDelete(q.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Question</DialogTitle>
          </DialogHeader>
          <QuestionForm
            onSaved={() => {
              setShowCreate(false);
              loadQuestions();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editing && (
            <QuestionForm
              initial={editing}
              onSaved={() => {
                setEditing(null);
                loadQuestions();
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
