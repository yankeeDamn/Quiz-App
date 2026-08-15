'use client';

import { useEffect, useState } from 'react';
import {
  getAdminCourses,
  createAdminCourse,
  type AdminCourse,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

function CourseForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [examCode, setExamCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createAdminCourse({ name, description, color, examCode });
    if (res.success) {
      onSaved();
    } else {
      setError(res.error?.message ?? 'Failed to create course');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="space-y-1">
        <Label htmlFor="name">Course name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Google Cloud"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="examCode">Exam code</Label>
          <Input
            id="examCode"
            value={examCode}
            onChange={(e) => setExamCode(e.target.value)}
            placeholder="e.g. AZ-900"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="color">Brand colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#6366F1"
            />
          </div>
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Creating…' : 'Create Course'}
      </Button>
    </form>
  );
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function loadCourses() {
    setLoading(true);
    const res = await getAdminCourses();
    if (res.success && res.data) {
      setCourses(Array.isArray(res.data) ? res.data : []);
    } else {
      setError(res.error?.message ?? 'Failed to load courses');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCourses();
  }, []);

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
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted-foreground mt-1">{courses.length} exam providers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Course</DialogTitle>
            </DialogHeader>
            <CourseForm
              onSaved={() => {
                setDialogOpen(false);
                loadCourses();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div className="h-2" style={{ backgroundColor: c.color }} />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {c.name}
                {c.exam_code && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                    {c.exam_code}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{c.description || '—'}</p>
              <p className="mt-2 text-sm font-medium">
                {c.question_count ?? 0} questions
              </p>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && (
          <p className="text-muted-foreground text-sm col-span-full">
            No courses yet. Add your first course above.
          </p>
        )}
      </div>
    </div>
  );
}
