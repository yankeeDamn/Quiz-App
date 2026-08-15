#!/usr/bin/env node
'use strict';

/**
 * Seed script — imports the static question/provider data from
 * exam-practice-pro/data/quizzes.ts into the PostgreSQL database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node src/db/seed.js
 *
 * Safe to run multiple times: uses ON CONFLICT DO NOTHING for questions
 * and upserts for courses.
 *
 * NOTE: This script runs in Node.js (CJS) and cannot import TypeScript
 * directly.  The question data has been transcribed into a plain JS
 * equivalent below.  After seeding, the canonical source of truth is
 * the database; update questions via the admin panel instead.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
});

// ── Exam providers (courses) ────────────────────────────

const examProviders = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    description: 'Azure, Microsoft 365, and other Microsoft certifications',
    color: '#00A4EF',
    examCode: '',
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'AWS Cloud certifications and specializations',
    color: '#FF9900',
    examCode: '',
  },
  {
    id: 'google',
    name: 'Google Cloud',
    description: 'Google Cloud Platform certifications',
    color: '#4285F4',
    examCode: '',
  },
  {
    id: 'comptia',
    name: 'CompTIA',
    description: 'Foundational IT certifications',
    color: '#C8202F',
    examCode: '',
  },
  {
    id: 'general',
    name: 'General',
    description: 'General knowledge and practice exams',
    color: '#6366F1',
    examCode: '',
  },
];

// ── Questions (transcribed from exam-practice-pro/data/quizzes.ts) ─

const questions = [
  // ── Mathematics — Algebra ──
  {
    id: 'math-1',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'Easy',
    type: 'single',
    questionText: 'What is the value of x if 2x + 6 = 14?',
    options: [
      { id: 'a', text: '2' },
      { id: 'b', text: '4' },
      { id: 'c', text: '6' },
      { id: 'd', text: '8' },
    ],
    correctAnswers: ['b'],
    explanation:
      'To solve 2x + 6 = 14, subtract 6 from both sides to get 2x = 8, then divide by 2 to get x = 4.',
  },
  {
    id: 'math-2',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'Medium',
    type: 'single',
    questionText: 'Simplify the expression: 3(x + 2) - 2(x - 1)',
    options: [
      { id: 'a', text: 'x + 4' },
      { id: 'b', text: 'x + 8' },
      { id: 'c', text: '5x + 4' },
      { id: 'd', text: 'x + 6' },
    ],
    correctAnswers: ['b'],
    explanation:
      '3(x + 2) - 2(x - 1) = 3x + 6 - 2x + 2 = x + 8.',
  },
  {
    id: 'math-3',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'Hard',
    type: 'single',
    questionText: 'If f(x) = x² - 3x + 2, what are the roots of f(x)?',
    options: [
      { id: 'a', text: 'x = 1, x = 2' },
      { id: 'b', text: 'x = -1, x = -2' },
      { id: 'c', text: 'x = 0, x = 3' },
      { id: 'd', text: 'x = -1, x = 2' },
    ],
    correctAnswers: ['a'],
    explanation:
      'Factor x² - 3x + 2 = (x - 1)(x - 2) = 0. Roots are x = 1 and x = 2.',
  },
  // ── Mathematics — Geometry ──
  {
    id: 'math-4',
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'Easy',
    type: 'single',
    questionText: 'What is the area of a rectangle with length 8 cm and width 5 cm?',
    options: [
      { id: 'a', text: '13 cm²' },
      { id: 'b', text: '26 cm²' },
      { id: 'c', text: '40 cm²' },
      { id: 'd', text: '45 cm²' },
    ],
    correctAnswers: ['c'],
    explanation: 'Area = length × width = 8 × 5 = 40 cm².',
  },
  {
    id: 'math-5',
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'Medium',
    type: 'single',
    questionText:
      'In a right triangle, if one leg is 3 and another leg is 4, what is the hypotenuse?',
    options: [
      { id: 'a', text: '5' },
      { id: 'b', text: '6' },
      { id: 'c', text: '7' },
      { id: 'd', text: '25' },
    ],
    correctAnswers: ['a'],
    explanation:
      'By the Pythagorean theorem: c² = 3² + 4² = 9 + 16 = 25, so c = 5.',
  },
];

// ── Seed helpers ────────────────────────────────────────

async function seedCourses(client) {
  console.log('  Seeding courses…');
  for (const p of examProviders) {
    await client.query(
      `INSERT INTO courses (id, name, description, color, exam_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         description = EXCLUDED.description,
         color       = EXCLUDED.color,
         updated_at  = NOW()`,
      [p.id, p.name, p.description, p.color, p.examCode]
    );
  }
  console.log(`  ✅ ${examProviders.length} courses seeded.`);
}

async function seedQuestions(client) {
  console.log('  Seeding questions…');
  let inserted = 0;
  let skipped = 0;

  for (const q of questions) {
    const result = await client.query(
      `INSERT INTO questions
         (quiz_id, subject, topic, difficulty, type, question_text,
          options, correct_answers, explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [
        q.id,
        q.subject,
        q.topic,
        q.difficulty,
        q.type,
        q.questionText,
        JSON.stringify(q.options),
        JSON.stringify(q.correctAnswers),
        q.explanation,
      ]
    );

    if (result.rowCount > 0) inserted++;
    else skipped++;
  }

  console.log(`  ✅ Questions: ${inserted} inserted, ${skipped} already existed.`);
}

async function addCourseIdColumn(client) {
  // Add the UUID-based id column to courses if it doesn't exist yet
  // (the migrate.js uses gen_random_uuid() by default; we want to seed with
  //  the string IDs from the frontend so we need to accept them as the PK)
  await client.query(`
    ALTER TABLE courses
      ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
  `).catch(() => { /* already varchar */ });
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Courses table uses a UUID PK by default — allow string IDs from the
    // static frontend data by relaxing the PK type.
    await addCourseIdColumn(client);

    await seedCourses(client);
    await seedQuestions(client);

    await client.query('COMMIT');
    console.log('✅ Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
