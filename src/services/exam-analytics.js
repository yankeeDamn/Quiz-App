'use strict';

/** Aggregate a server-graded result. No client-provided scores or answers are trusted. */
function buildAnalytics(snapshot, result, startedAt, submittedAt) {
  if (!snapshot || !result || !Array.isArray(snapshot.questions) || !Array.isArray(result.review)) {
    throw Object.assign(new Error('Completed scored attempt required'), { statusCode: 409 });
  }
  const sections = (snapshot.sections || []).map((section, index) => ({
    index, name: section.name || 'Section ' + (index + 1),
    total: 0, attempted: 0, correct: 0, incorrect: 0, skipped: 0, score: 0,
  }));
  const topics = new Map();
  const answers = new Map(result.review.map(item => [item.id, item]));
  for (const q of snapshot.questions) {
    const item = answers.get(q.id);
    if (!item) continue;
    const name = String(q.topicName || q.topic || 'General');
    const topicKey = String(q.topic || name);
    const topic = topics.get(topicKey) || { topicId: topicKey, name, total: 0, attempted: 0, correct: 0, incorrect: 0, skipped: 0 };
    const section = sections[q.section];
    const selected = Number(item.selected);
    const skipped = selected === -1 || !Number.isInteger(selected);
    const correct = !skipped && item.correct === true;
    topic.total++;
    if (section) section.total++;
    if (skipped) {
      topic.skipped++;
      if (section) section.skipped++;
    } else {
      topic.attempted++;
      if (section) section.attempted++;
      if (correct) {
        topic.correct++;
        if (section) { section.correct++; section.score += Number(snapshot.marksPerCorrect || 1); }
      } else {
        topic.incorrect++;
        if (section) { section.incorrect++; section.score -= Number(snapshot.negativeMarks || 0); }
      }
    }
    topics.set(topicKey, topic);
  }
  const percent = v => v.attempted ? Math.round(100 * v.correct / v.attempted) : null;
  const finalizedTopics = Array.from(topics.values()).map(v => ({...v, accuracy: percent(v)}));
  finalizedTopics.sort((a,b) => (a.accuracy === null ? -1 : a.accuracy) - (b.accuracy === null ? -1 : b.accuracy) || b.incorrect - a.incorrect);
  const weakTopics = finalizedTopics.filter(v => v.incorrect > 0 || v.skipped > 0).slice(0, 3)
    .map(v => ({ topicId:v.topicId, name:v.name, incorrect:v.incorrect, skipped:v.skipped,
      suggestion: v.skipped > v.incorrect ? 'Review the basics and complete a topic practice set.' : 'Review explanations, then retake a focused topic practice set.' }));
  const elapsedSeconds = Math.max(0, Math.round((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  return {
    questions: snapshot.questions.length,
    score: Number(result.score), totalMarks: Number(result.total), percentage: Number(result.percentage),
    accuracy: result.correct + result.incorrect ? Math.round(100 * result.correct / (result.correct + result.incorrect)) : null,
    elapsedSeconds, allowedSeconds: Math.round(Number(snapshot.minutes) * 60),
    sections: sections.map(v => ({...v,score:Math.round(v.score*100)/100,accuracy:percent(v)})),
    topics: finalizedTopics, weakTopics,
    // We have total duration, NOT per-question time or a real population percentile.
    methodology: 'Based only on your submitted server-graded answers; accuracy excludes skipped questions. No peer percentile or per-question timing is inferred.',
  };
}
module.exports = { buildAnalytics };
