"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.ADMIN_EMAILS = "ebook-owner@example.com";
const seeds = require("../content/ebooks-starter.json");
const service = require("../src/services/ebooks.service");
const owner = { email: "ebook-owner@example.com" },
  reader = { email: "reader@example.com" };
const copy = (value) => JSON.parse(JSON.stringify(value));
test("ten ebook seeds retain the original three and have five chapters, two checks each and fifteen valid exam questions", () => {
  assert.deepEqual(
    seeds.slice(0, 3).map((b) => b.slug),
    ["python-mastery", "ai-with-copilot", "java-enterprise"],
  );
  assert.equal(seeds.length, 10);
  assert.equal(new Set(seeds.map((b) => b.slug)).size, 10);
  for (const book of seeds) {
    const valid = service.validateBook(book, book.slug);
    assert.equal(valid.chapters.length, 5);
    assert.equal(valid.finalExamQuestions.length, 15);
    for (const chapter of valid.chapters) {
      assert.equal(chapter.conceptChecks.length, 2);
      assert.ok(chapter.contentMarkdown.length > 700);
      assert.ok(chapter.codeSnippet.code.length > 20);
      if (chapter.codeSnippet.language === "json")
        assert.doesNotThrow(() => JSON.parse(chapter.codeSnippet.code));
    }
  }
});
test("RBAC covers anonymous, reader, editor, revoked and owner access across visibility modes", () => {
  for (const visibility of ["admin_only", "invite_only", "public"]) {
    assert.equal(
      service.permissions({ visibility }, owner, null).canManageAccess,
      true,
    );
    assert.equal(
      service.permissions({ visibility }, null, null).canRead,
      visibility === "public",
    );
    for (const role of ["reader", "editor"]) {
      const rights = service.permissions({ visibility }, reader, {
        role,
        status: "approved",
      });
      assert.equal(rights.canRead, visibility !== "admin_only");
      assert.equal(
        rights.canEdit,
        visibility !== "admin_only" && role === "editor",
      );
      assert.equal(rights.canManageAccess, false);
    }
    assert.equal(
      service.permissions({ visibility }, reader, {
        role: "editor",
        status: "revoked",
      }).canEdit,
      false,
    );
  }
});
test("owner detection does not trust role claims or public environment values", () => {
  assert.equal(
    service.isOwnerAdmin({
      email: "unapproved@example.com",
      role: "admin",
      isOwnerAdmin: true,
    }),
    false,
  );
  assert.equal(
    service.isOwnerAdmin({ email: "EBOOK-OWNER@example.com" }),
    true,
  );
});
test("book validation strips owner/access injection and rejects malformed checks and answers", () => {
  const raw = {
    ...copy(seeds[0]),
    ownerEmail: "attacker@example.com",
    approvedAccess: [{ email: reader.email, role: "editor" }],
  };
  const valid = service.validateBook(raw, "custom-book");
  assert.equal(valid.ownerEmail, undefined);
  assert.equal(valid.approvedAccess, undefined);
  raw.chapters[0].conceptChecks.pop();
  assert.throws(
    () => service.validateBook(raw, "custom-book"),
    /two concept checks/,
  );
  const duplicate = copy(seeds[0]);
  duplicate.chapters[1].id = duplicate.chapters[0].id;
  assert.throws(() => service.validateBook(duplicate, "custom-book"), /unique/);
  const invalid = copy(seeds[0]);
  invalid.finalExamQuestions[0].answer = 4;
  assert.throws(() => service.validateBook(invalid, "custom-book"), /index/);
});
test("server grading uses stored keys and applies exact pass boundary and negative marking", () => {
  const snapshot = {
    finalExamQuestions: Array.from({ length: 10 }, (_, i) => ({
      id: `q${i}`,
      question: "Sample question",
      options: ["A", "B", "C", "D"],
      answer: 0,
      explanation: "A is correct.",
    })),
  };
  const answers = Object.fromEntries(
    snapshot.finalExamQuestions.slice(0, 7).map((q) => [q.id, 0]),
  );
  assert.equal(service.grade(snapshot, answers, 0).percentage, 70);
  assert.equal(service.grade(snapshot, answers, 0).passed, true);
  answers.q7 = 1;
  assert.equal(service.grade(snapshot, answers, 0.25).percentage, 67.5);
  assert.equal(service.grade(snapshot, answers, 0.25).passed, false);
  assert.equal(service.grade(snapshot, {}, 0).score, 0);
  assert.throws(
    () => service.cleanAnswers({ unknown: 0 }, snapshot),
    /Unknown question/,
  );
  assert.throws(
    () => service.cleanAnswers({ q0: 3.5 }, snapshot),
    /invalid option/,
  );
});
test("new ebook write routes reject anonymous and automation keys before any database write", async () => {
  const app = require("../src/app");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const response = await fetch(
        base +
          "/api/v1/admin/ebooks" +
          (method === "POST" ? "" : "/private-book"),
        {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": "even-an-admin-api-key",
          },
          body: method === "DELETE" ? undefined : JSON.stringify(seeds[0]),
        },
      );
      assert.equal(response.status, 401);
      assert.match(response.headers.get("cache-control"), /private/);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("optional Phase 2 fields default compatibly and validate PDF URLs and exam settings", () => {
  const legacy = service.validateBook(copy(seeds[0]), "legacy-learning");
  assert.equal(legacy.allowPdfDownload, true);
  assert.equal(legacy.passPercent, 70);
  assert.equal(legacy.marksPerCorrect, 1);
  assert.equal(legacy.negativeMarks, 0);
  assert.equal(legacy.pdfUrl, "");
  const raw = {
    ...copy(seeds[0]),
    visibility: "invite_only",
    pdfUrl: "/api/v1/ebooks/private-pdf/pdf",
    passPercent: 80,
    marksPerCorrect: 2,
    negativeMarks: 0.25,
    examBadgeCode: "DEMO",
    version: "2.0",
    isCheatSheet: true,
  };
  const valid = service.validateBook(raw, "private-pdf");
  assert.equal(valid.pdfUrl, raw.pdfUrl);
  assert.equal(valid.passPercent, 80);
  assert.equal(valid.isCheatSheet, true);
  for (const pdfUrl of [
    "javascript:alert(1)",
    "http://example.com/a.pdf",
    "https://user:password@example.com/a.pdf",
    "https://example.com/a.html",
    "/api/v1/ebooks/another-book/pdf",
  ])
    assert.throws(
      () => service.validateBook({ ...raw, pdfUrl }, "private-pdf"),
      /PDF|HTTPS/,
    );
  assert.throws(
    () =>
      service.validateBook(
        { ...raw, pdfUrl: "https://example.com/a.pdf" },
        "private-pdf",
      ),
    /Restricted/,
  );
  assert.equal(
    service.validateBook(
      { ...raw, visibility: "public", pdfUrl: "https://example.com/a.pdf" },
      "private-pdf",
    ).pdfUrl,
    "https://example.com/a.pdf",
  );
  for (const patch of [
    { passPercent: 101 },
    { marksPerCorrect: 0 },
    { negativeMarks: -0.25 },
    { allowPdfDownload: "yes" },
  ])
    assert.throws(() =>
      service.validateBook({ ...raw, ...patch }, "private-pdf"),
    );
});
test("configured grading uses an attempt snapshot, custom marks and per-domain breakdown", () => {
  const snapshot = {
    passPercent: 80,
    marksPerCorrect: 2,
    finalExamQuestions: [0, 1, 2, 3, 4].map((i) => ({
      id: "q" + i,
      question: "Sample",
      options: ["A", "B", "C", "D"],
      answer: 0,
      explanation: "A wins",
      domain: i < 3 ? "Pipelines" : "Serving",
    })),
  };
  const answers = { q0: 0, q1: 0, q2: 0, q3: 0, q4: 1 };
  let result = service.grade(snapshot, answers, 0);
  assert.equal(result.score, 8);
  assert.equal(result.maxScore, 10);
  assert.equal(result.percentage, 80);
  assert.equal(result.passed, true);
  assert.deepEqual(result.domains, [
    { domain: "Pipelines", correct: 3, total: 3 },
    { domain: "Serving", correct: 1, total: 2 },
  ]);
  result = service.grade(snapshot, answers, 0.25);
  assert.equal(result.percentage, 77.5);
  assert.equal(result.passed, false);
  assert.equal(result.passPercent, 80);
});
