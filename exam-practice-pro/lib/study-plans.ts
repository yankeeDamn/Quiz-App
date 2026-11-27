import { api } from "./api";
export interface StudyProgress {
  total: number;
  completed: number;
  pending: number;
  percentage: number;
  completedDays: number[];
  completedTopics: string[];
  nextTaskId: string | null;
  completions: { task_id: string; completed_at: string }[];
  enrollment: { start_date: string; current_day: number };
  results: { id: string; test_id: string; submitted_at: string }[];
}
export type StudyTrack = "government-exams" | "it-certifications";
export interface UpcomingStudyPlan {
  id: string;
  name: string;
  description: string;
  track?: StudyTrack;
  provider?: string;
}
export interface StudyCatalogue {
  plans: StudyPlan[];
  upcoming: UpcomingStudyPlan[];
}
export interface StudyPlan {
  exam_id?: string;
  track?: StudyTrack;
  id: string;
  slug: string;
  edition: number;
  title: string;
  description: string;
  name: string;
  syllabus_version: string;
  duration: number;
  daily_minutes: number;
  access_policy: string;
  access: boolean;
  preview: boolean;
  subjects: ({ name: string } | string)[];
  modules?: number;
  weekly_goals?: string;
  completion_criteria?: string;
  milestones?: { day: number; title: string; kind: string }[];
  days: { day: number; objectives: string; tasks: number; previews: number }[];
  progress?: StudyProgress | null;
}
export interface StudyQuestion {
  id: string;
  question: string;
  options: string[];
}
export interface StudyTask {
  id: string;
  day: number;
  title: string;
  description: string;
  kind: string;
  minutes: number;
  required: boolean;
  preview: boolean;
  mock_id: string | null;
  questions: StudyQuestion[];
  resource: { id: string; title: string; kind: string } | null;
}
export interface StudyDay {
  planId: string;
  title: string;
  day: number;
  duration: number;
  objectives: string;
  access: boolean;
  tasks: StudyTask[];
  preview: boolean;
}
export async function study<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await api<T>("/api/v1/study-plans" + path, {
    method,
    body,
    optionalAuth: method === "GET" || path.endsWith("/answer"),
  });
  if (!r.success || !r.data)
    throw new Error(r.error?.message || "Unable to load Study Plans");
  return r.data;
}
