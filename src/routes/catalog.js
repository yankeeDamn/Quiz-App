'use strict';
const { Router } = require('express');
const { categories, questions } = require('../data/exam-catalog');
const router = Router();
// Public practice catalog only. Never expose answerIndex or explanations in exam delivery endpoints.
router.get('/categories', (_req, res) => res.json({ categories }));
router.get('/tests', (req, res) => {
  const { category, subject } = req.query;
  const tests = categories.filter(c => !category || c.id === category).flatMap(c =>
    c.subjects.filter(s => !subject || s === subject).map(s => ({
      id: `${c.id}-${s.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
      categoryId: c.id, categoryName: c.name, subject: s,
      questionCount: questions.filter(q => q.categoryId === c.id && q.subject === s).length,
      durationMinutes: 15, marksPerCorrect: 1, negativeMarks: 0
    }))
  );
  res.json({ tests });
});
router.get('/tests/:id/questions', (req, res) => {
  const test = categories.flatMap(c => c.subjects.map(s => ({
    id: `${c.id}-${s.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, categoryId:c.id, subject:s
  }))).find(t => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  const items = questions.filter(q => q.categoryId === test.categoryId && q.subject === test.subject)
    .map(({ id,prompt,options,subject,difficulty }) => ({ id,prompt,options,subject,difficulty }));
  return res.json({ test, questions:items });
});
module.exports = router;
