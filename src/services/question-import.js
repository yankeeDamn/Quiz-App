"use strict";
const db = require("../config/database");
const content = require("./content.service");
const mocks = require("./mocks.service");

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("en");
}

function inspect(rows, existing, pyq = false) {
  const errors = [],
    values = [],
    seen = new Set(existing.map(normalize));
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200)
    return {
      errors: [{ row: 0, message: "Send 1 to 200 questions" }],
      values: [],
    };
  rows.forEach((row, i) => {
    if (pyq && (!row || !Number.isInteger(row.answer))) {
      errors.push({
        row: i + 2,
        message: "Correct answer must be an integer option index 0–3",
      });
      return;
    }
    const checked = content.checkQuestion(row);
    let metadata;
    if (pyq) {
      try {
        metadata = require("./study-plans.validation").metadata(row.pyq);
        // Imports always need human provenance review after upload.
        metadata.verification = "unverified";
      } catch (error) {
        errors.push({ row: i + 2, message: error.message });
        return;
      }
    }
    if (!checked.ok) {
      errors.push({ row: i + 2, message: checked.error });
      return;
    }
    const key = normalize(checked.value.question);
    if (seen.has(key)) {
      errors.push({
        row: i + 2,
        message: "Duplicate question (existing or repeated in file)",
      });
      return;
    }
    seen.add(key);
    values.push({ ...checked.value, ...(metadata ? { pyq: metadata } : {}) });
  });
  return { errors, values };
}
async function checkPyqReferences(values, client) {
  const errors = [];
  for (const [i, v] of values.entries()) {
    const m = v.pyq;
    const exam = await client.query("SELECT id FROM study_exams WHERE id=$1", [
      m.exam_id,
    ]);
    if (!exam.rowCount) {
      errors.push({ row: i + 2, message: "Exam identifier does not exist" });
      continue;
    }
    if (m.topic_id) {
      const t = await client.query(
        "SELECT t.id FROM study_topics t JOIN study_syllabuses s ON s.id=t.syllabus_id WHERE t.id=$1 AND s.exam_id=$2",
        [m.topic_id, m.exam_id],
      );
      if (!t.rowCount)
        errors.push({
          row: i + 2,
          message: "Syllabus topic does not belong to this exam",
        });
    }
  }
  return errors;
}
async function preview(topicId, rows, options = {}) {
  const r = await db.query(
    options.pyq
      ? "SELECT question FROM mock_questions"
      : "SELECT question FROM mock_questions WHERE topic_id=$1",
    options.pyq ? [] : [topicId],
  );
  const result = inspect(
    rows,
    r.rows.map((x) => x.question),
    options.pyq,
  );
  if (options.pyq && !result.errors.length)
    result.errors.push(...(await checkPyqReferences(result.values, db)));
  return {
    valid: result.errors.length === 0,
    count: result.values.length,
    errors: result.errors,
  };
}
async function importRows(topicId, rows, options = {}) {
  if (options.pyq && !options.actor)
    throw Object.assign(new Error("Verified administrator required"), {
      statusCode: 403,
    });
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "question-import",
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [topicId]);
    const topic = await client.query(
      "SELECT id FROM mock_topics WHERE id=$1 FOR UPDATE",
      [topicId],
    );
    if (!topic.rowCount)
      throw Object.assign(new Error("Topic not found"), { statusCode: 404 });
    const existing = await client.query(
      options.pyq
        ? "SELECT question FROM mock_questions"
        : "SELECT question FROM mock_questions WHERE topic_id=$1",
      options.pyq ? [] : [topicId],
    );
    const checked = inspect(
      rows,
      existing.rows.map((x) => x.question),
      options.pyq,
    );
    if (options.pyq && !checked.errors.length)
      checked.errors.push(
        ...(await checkPyqReferences(checked.values, client)),
      );
    if (checked.errors.length) {
      await client.query("ROLLBACK");
      return { valid: false, errors: checked.errors, added: 0 };
    }
    const position = await client.query(
      "SELECT COALESCE(MAX(position),-1)::int AS last FROM mock_questions WHERE topic_id=$1",
      [topicId],
    );
    let next = position.rows[0].last + 1;
    for (const v of checked.values) {
      const saved = await client.query(
        "INSERT INTO mock_questions(topic_id,position,question,options,answer,explanation,difficulty) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id",
        [
          topicId,
          next++,
          v.question,
          JSON.stringify(v.options),
          v.answer,
          v.explanation,
          v.difficulty,
        ],
      );
      if (options.pyq) {
        const m = v.pyq;
        if (m.topic_id) {
          const valid = await client.query(
            "SELECT t.id FROM study_topics t JOIN study_syllabuses s ON s.id=t.syllabus_id WHERE t.id=$1 AND s.exam_id=$2",
            [m.topic_id, m.exam_id],
          );
          if (!valid.rowCount)
            throw Object.assign(
              new Error("PYQ topic does not belong to exam"),
              { statusCode: 400 },
            );
        }
        await client.query(
          "INSERT INTO study_pyq_metadata(question_id,exam_id,topic_id,exam_year,stage,session,language,source,verification,rights_notes,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            saved.rows[0].id,
            m.exam_id,
            m.topic_id,
            m.exam_year,
            m.stage,
            m.session,
            m.language,
            m.source,
            m.verification,
            m.rights_notes,
            options.actor,
          ],
        );
      }
    }
    await client.query("COMMIT");
    mocks.invalidate();
    return { valid: true, errors: [], added: checked.values.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { inspect, preview, importRows };
