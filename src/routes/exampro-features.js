'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const config = require('../config');
const mocks = require('../services/mocks.service');

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

const translateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function validTexts(texts) {
  return Array.isArray(texts) && texts.length > 0 && texts.length <= 8 &&
    texts.every(t => typeof t === 'string' && t.trim().length > 0 && t.length <= 1000) &&
    texts.reduce((sum, s) => sum + s.length, 0) <= 3600;
}

/**
 * Optional Azure AI Translator proxy. All secrets remain server-side.
 * Treat these responses as advisory text; they NEVER change exam answer keys.
 */
router.post('/translate', translateLimiter, wrap(async (req, res) => {
  const { language, texts } = req.body || {};
  if (!['hi','bn'].includes(language) || !validTexts(texts)) {
    return res.status(400).json({success:false,error:{message:'Invalid language or text batch.'}});
  }
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key || !region) {
    return res.status(503).json({success:false,error:{code:'TRANSLATION_UNAVAILABLE', message:'Translation is not configured on the backend.'}});
  }
  const url = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' + language;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type':'application/json',
        'Ocp-Apim-Subscription-Key':key,
        'Ocp-Apim-Subscription-Region':region,
      },
      body: JSON.stringify(texts.map(text => ({Text:text}))),
    });
  } catch {
    return res.status(502).json({success:false,error:{message:'Translation provider is unavailable.'}});
  }
  if (!response.ok) return res.status(502).json({success:false,error:{message:'Translation provider rejected the request.'}});
  let data;
  try { data = await response.json(); } catch { return res.status(502).json({success:false,error:{message:'Invalid translation response.'}}); }
  const translated = Array.isArray(data) && data.length === texts.length
    ? data.map(v => v?.translations?.[0]?.text) : [];
  if (translated.length !== texts.length || translated.some(v => typeof v !== 'string')) {
    return res.status(502).json({success:false,error:{message:'Incomplete translation response.'}});
  }
  return res.json({success:true,data:{texts:translated}});
}));

module.exports = {router, validTexts, topicIds};
