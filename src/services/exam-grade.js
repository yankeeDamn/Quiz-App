'use strict';

/** Immutable snapshot supplied by the server, never by the student. */
function cleanResponses(snapshot, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw Object.assign(new Error('Invalid responses'), { statusCode: 400 });
  const valid = new Set(snapshot.questions.map((q) => q.id));
  const out = {};
  for (const [id, value] of Object.entries(source)) {
    if (!valid.has(id) || !Number.isInteger(value) || value < -1 || value > 3) {
      throw Object.assign(new Error('Invalid question or option'), { statusCode: 400 });
    }
    if (value >= 0) out[id] = value;
  }
  return out;
}

function grade(snapshot, responses) {
  let correct = 0, incorrect = 0, skipped = 0, score = 0;
  const review = snapshot.questions.map((q) => {
    const selected = Object.prototype.hasOwnProperty.call(responses, q.id) ? responses[q.id] : -1;
    const isCorrect = selected === q.answer;
    if (selected === -1) skipped++;
    else if (isCorrect) { correct++; score += snapshot.marksPerCorrect; }
    else { incorrect++; score -= snapshot.negativeMarks; }
    return { id: q.id, question: q.question, options: q.options, selected, correctAnswer: q.answer, explanation: q.explanation, correct: isCorrect && selected !== -1 };
  });
  const total = Math.round(snapshot.questions.length * snapshot.marksPerCorrect * 100) / 100;
  score = Math.round(score * 100) / 100;
  const percentage = total ? Math.max(0, Math.round((score / total) * 10000) / 100) : 0;
  return { correct, incorrect, skipped, score, total, percentage, passed: percentage >= snapshot.passPercent, review };
}

function visibleAttempt(row) {
  const snapshot = row.snapshot;
  const result = row.result || null;
  return {
    id: row.id, testId: row.test_id, title: snapshot.name, startedAt: row.started_at,
    deadlineAt: row.deadline_at, submittedAt: row.submitted_at, responses: row.responses,
    test: {
      id: row.test_id, name: snapshot.name, minutes: snapshot.minutes, tier: snapshot.tier,
      marksPerCorrect: snapshot.marksPerCorrect, negativeMarks: snapshot.negativeMarks,
      passPercent: snapshot.passPercent, sections: snapshot.sections,
      questions: snapshot.questions.map((q) => ({ id: q.id, topic: q.topic, section: q.section, question: q.question, options: q.options })),
    },
    result,
  };
}
module.exports = { cleanResponses, grade, visibleAttempt };
