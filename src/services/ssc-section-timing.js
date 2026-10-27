'use strict';

/**
 * Official-pattern SSC CGL Tier-I 2026 timing policy for standard candidates.
 * Only opt in **complete** 4×25 full mocks; never change mini-mock timing.
 * See SSC 2026 Tier-I notice §13.8: 15 minutes per section, 60 total.
 */
const SECTION_NAMES = [/reason/i, /general awareness|general knowledge|\bgk\b|\bgs\b/i, /quant|math|aptitude/i, /english/i];

function eligible(test) {
  return Boolean(
    test && test.kind === 'mock' && /ssc/i.test(String(test.exam)) &&
    /cgl/i.test(String(test.name)) &&
    test.minutes === 60 && Number(test.marksPerCorrect) === 2 &&
    Number(test.negativeMarks) === 0.5 &&
    Array.isArray(test.questions) && test.questions.length === 100 &&
    Array.isArray(test.sections) && test.sections.length === 4 &&
    test.sections.every((s, index) =>
      s.from === index * 25 &&
      s.to === (index + 1) * 25 &&
      SECTION_NAMES[index].test(String(s.name)) &&
      test.questions.slice(s.from, s.to).every(q => q.section === index)
    ) &&
    new Set(test.questions.map(q => q.id)).size === 100
  );
}

/** Returns null for conventional timed exams and all current incomplete mini-mocks. */
function sectionTiming(snapshot, startedAt, now = Date.now()) {
  if (snapshot?.sectionTimingMinutes !== 15 || !Array.isArray(snapshot.sections) || snapshot.sections.length !== 4) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) throw new Error('Invalid stored exam start time');
  const duration = 15 * 60 * 1000;
  const elapsed = Math.max(0, now - start);
  const sectionIndex = Math.min(4, Math.floor(elapsed / duration));
  const sectionEndsAt = new Date(start + (Math.min(sectionIndex, 3) + 1) * duration).toISOString();
  return { sectionIndex, sectionEndsAt, finished: sectionIndex >= 4 };
}

const error = message => Object.assign(new Error(message), { statusCode: 409 });

/**
 * Do not trust client-sent question IDs to bypass expired section cutoffs.
 * Persist completed-section answers without edits; only mutate current section.
 * Accept omitted past responses (e.g., stale tab), but never silently edit them.
 */
function lockedResponses(snapshot, persisted, incoming, clock) {
  if (!clock || clock.finished) throw error('Section has ended. Submit previously saved answers.');
  const result = { ...persisted };
  const sectionOf = new Map(snapshot.questions.map(q => [q.id, q.section]));
  for (const [id, answer] of Object.entries(incoming)) {
    const section = sectionOf.get(id);
    if (section === undefined) throw error('Invalid question ID');
    if (section > clock.sectionIndex) throw error('A future exam section is still locked.');
    if (section < clock.sectionIndex && persisted[id] !== answer) {
      throw error('Previous section is locked. Your earlier saved answers are preserved.');
    }
  }
  const activeQuestions = snapshot.questions.filter(q => q.section === clock.sectionIndex);
  for (const q of activeQuestions) {
    if (Object.prototype.hasOwnProperty.call(incoming, q.id)) result[q.id] = incoming[q.id];
    else delete result[q.id];
  }
  return result;
}

module.exports = { eligible, sectionTiming, lockedResponses };
