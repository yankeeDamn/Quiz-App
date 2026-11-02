export type TrackEvent =
  | 'sign_in'
  | 'mock_started'
  | 'mock_completed'
  | 'pricing_viewed'
  | 'pro_requested_whatsapp';
export type TrackProps = {
  exam_slug?: string;
  test_id?: string;
  plan_name?: 'free' | 'pro' | 'institute';
};
export const EVENTS: readonly TrackEvent[];
export function validateEvent(
  event: unknown,
  props?: unknown,
): Record<string, string> | null;
export function createTracker(
  send: (event: string, props: Record<string, string>) => void,
  enabled: () => boolean,
): (event: TrackEvent, props?: TrackProps) => boolean;
export function analyticsUrl(raw: string, customEvent?: boolean): string | null;
