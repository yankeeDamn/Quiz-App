"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const v = require("../src/services/study-plans.validation");
const importer = require("../src/services/question-import");
const { createService } = require("../src/services/study-plans.service");
const id = "11111111-1111-4111-8111-111111111111";
test("completion is derived from required tasks, timestamps and actual rows", () => {
  const ts = [
    { id: "a", day: 1, topic_id: "topic", required: true },
    { id: "b", day: 1, topic_id: "topic", required: true },
    { id: "c", day: 2, required: false },
  ];
  const p = v.progress(ts, [
    { task_id: "a", completed_at: "2026-01-01" },
    { task_id: "c", completed_at: "2026-01-01" },
  ]);
  assert.equal(p.percentage, 50);
  assert.equal(p.nextTaskId, "b");
  assert.deepEqual(p.completedDays, []);
  assert.deepEqual(p.completedTopics, []);
  assert.deepEqual(
    v.progress(ts, [{ task_id: "a" }, { task_id: "b" }]).completedDays,
    [1],
  );
  assert.equal(v.progress([], []).percentage, 0);
});
test("invalid task fields, unsafe URLs and IDs fail closed", () => {
  for (const raw of [null, {}, { day: 0 }, { day: 1, kind: "bad" }])
    assert.throws(() => v.task(raw));
  for (const raw of [
    "https://localhost/file",
    "javascript:alert(1)",
    "https://127.0.0.1/x",
  ])
    assert.throws(() => v.url(raw));
  assert.throws(() => v.id("' OR 1=1"));
  assert.throws(() => v.integer("1", "Day"));
  assert.throws(() => v.boolean("false", "Preview"));
});
test("PYQ import rejects malformed and duplicated rows without inventing provenance", () => {
  const q = {
    question: "What is two plus two?",
    options: ["1", "2", "3", "4"],
    answer: 3,
    explanation: "Two plus two equals four.",
    pyq: { exam_id: "ssc-cgl" },
  };
  assert.equal(
    importer.inspect([q], [], true).values[0].pyq.verification,
    "unverified",
  );
  assert.equal(importer.inspect([q], [], true).values[0].pyq.exam_year, null);
  for (const answer of [null, undefined, "3", 4, -1])
    assert.equal(
      importer.inspect([{ ...q, answer }], [], true).errors.length,
      1,
    );
  assert.equal(importer.inspect([q, q], [], true).errors.length, 1);
  assert.equal(
    importer.inspect([q], [q.question.toUpperCase()], true).errors.length,
    1,
  );
  assert.equal(
    importer.inspect([{ ...q, options: ["a", "a", "b", "c"] }], [], true).errors
      .length,
    1,
  );
  assert.equal(
    importer.inspect(
      [{ ...q, pyq: { exam_id: "ssc-cgl", exam_year: "2025" } }],
      [],
      true,
    ).errors.length,
    1,
  );
});
test("Pro access rejects expired/revoked balances and exam-only passes", async () => {
  for (const [plan, expiry, grants, expected] of [
    ["free", null, true, false],
    ["pro", "2000-01-01", true, false],
    ["pro", "2099-01-01", false, true],
    ["institute", "2099-01-01", false, false],
    ["institute", "2099-01-01", true, true],
  ]) {
    const db = {
      query: async (sql) => ({
        rows: sql.includes("FROM users")
          ? [{ plan, plan_expires_at: expiry }]
          : grants
            ? [{ one: 1 }]
            : [],
      }),
    };
    assert.equal(await createService(db).pro({ id }), expected);
  }
});
test("student cannot use admin services by spoofing frontend role", async () => {
  const s = createService({
    query: () => {
      throw Error("Must not query");
    },
  });
  assert.throws(
    () => s.admin({ id, email: "not-admin@example.test", role: "admin" }),
    /authorized administrator/,
  );
  await assert.rejects(
    s.savePlan({ id, email: "not-admin@example.test" }, {}),
    /authorized administrator/,
  );
});
