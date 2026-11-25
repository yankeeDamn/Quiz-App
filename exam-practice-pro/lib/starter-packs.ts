import { api } from '@/lib/api';

/** A question in one of the Free, practice-only exam starter packs. `answer` is a 0-based option index. */
export interface StarterPackQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty?: string;
}

export type StarterPackContent = Record<string, StarterPackQuestion[]>;

/**
 * Starter packs ship with the site (content/separate-exam-practice-starter.json) and stay the
 * fallback. This fetches the admin-edited version; callers keep the bundled copy when it fails.
 */
export async function fetchStarterPacks(): Promise<StarterPackContent> {
  const res = await api<{ packs: StarterPackContent }>('/api/v1/practice/starter-packs', { public: true });
  if (!res.success || !res.data?.packs) throw new Error(res.error?.message || 'Could not load the practice packs');
  return res.data.packs;
}

/** Network-safe wrapper: undefined means "use the bundled questions". */
export async function fetchStarterPacksOrNull(): Promise<StarterPackContent | undefined> {
  try { return await fetchStarterPacks(); } catch { return undefined; }
}
