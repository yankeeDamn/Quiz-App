'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const config = require('../config');
const { authenticateNextAuth } = require('../middleware/nextauth');
const mocks = require('../services/mocks.service');
const azure = require('../services/azure-translator.service');

const router = Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const topicIds = new Set([
  'comp-banking-2026',
  'comp-railways-2026',
  'comp-ssc-cgl-2026',
  'comp-ssc-chsl-mts-2026',
]);

/** Safe metadata only. Unpublished tests or answer keys are never returned. */
router.get('/competitive-topics', wrap(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  let rows = [];
  if (config.databaseUrl) {
    const query = await db.query(`
      SELECT t.id, t.name, t.category, t.active, COUNT(q.id)::int AS "questionCount"
      FROM mock_topics t
      LEFT JOIN mock_questions q ON q.topic_id = t.id AND q.active
      WHERE t.id = ANY($1::text[])
      GROUP BY t.id, t.name, t.category, t.active
      ORDER BY t.name`, [Array.from(topicIds)]);
    rows = query.rows;
  }
  const published = await mocks.listMocks();
  const topics = rows.map(t => {
    const mock = published.find(m => m.kind === 'topic' && m.id === 'topic-' + t.id);
    return {
      id: t.id, name: t.name, category: t.category,
      questionCount: t.questionCount, active: Boolean(t.active),
      practiceTestId: mock?.id || null,
    };
  });
  res.json({ success: true, data: { topics } });
}));

/**
 * Signed-in student's own accuracy from *submitted scored attempts only*.
 * No review content, question answer keys, or other users' records leave the API.
 */
router.get('/topic-accuracy', authenticateNextAuth, wrap(async (req, res) => {
  const {rows}=await db.query(`
    SELECT split_part(item->>'id', ':', 1) AS "topicId",
      COUNT(*) FILTER (WHERE (item->>'selected')::int >= 0)::int AS attempted,
      COUNT(*) FILTER (WHERE (item->>'correct')::boolean)::int AS correct
    FROM exam_attempts_v2 a
    CROSS JOIN LATERAL jsonb_array_elements(a.result->'review') item
    WHERE a.user_id=$1 AND a.submitted_at IS NOT NULL AND
      split_part(item->>'id', ':', 1) = ANY($2::text[])
    GROUP BY split_part(item->>'id', ':', 1)
  `,[req.user.id,Array.from(topicIds)]);
  return res.json({success:true,data:{topics:rows.map(row=>({
    topicId:row.topicId,attempted:row.attempted,correct:row.correct,
    percent:row.attempted?Math.round(row.correct/row.attempted*100):0,
  }))}});
}));

const translateLimiter = rateLimit({
  windowMs:15*60*1000,max:30,standardHeaders:true,legacyHeaders:false,
});

// Full mock requires up to 100 distinct questions (5 strings per item).
// An authenticated user's ID, not a shared NAT IP, is the quota bucket.
const examTranslateLimiter = rateLimit({
  windowMs:15*60*1000,max:130,standardHeaders:true,legacyHeaders:false,
  keyGenerator:req=>'exam-translation:'+req.user.id,
});

async function translateRequest(req,res) {
  const {language,texts}=req.body||{};
  if(!['hi','bn'].includes(language)||!azure.validTexts(texts))
    return res.status(400).json({success:false,error:{message:'Invalid language or text batch.'}});
  const result=await azure.translate(texts,language);
  res.set('Cache-Control','no-store');
  return res.json({success:true,data:result});
}

/** Legacy public translation: tightly IP-rate limited for visitor previews. */
router.post('/translate',translateLimiter,wrap(translateRequest));

/**
 * Higher per-user quota for the real, signed-in exam hall and Admin review.
 * User cannot supply keys, URLs, question-answer data, or approval flags.
 */
router.post('/translate-exam',authenticateNextAuth,examTranslateLimiter,wrap(translateRequest));

module.exports = {router, validTexts:azure.validTexts, topicIds};
