"use strict";
// Only run against a disposable database: EBOOK_TEST_DATABASE_URL must be explicit.
const test = require("node:test"),
  assert = require("node:assert/strict");
if (!process.env.EBOOK_TEST_DATABASE_URL)
  throw Error(
    "EBOOK_TEST_DATABASE_URL is required; never target a production database.",
  );
process.env.DATABASE_URL = process.env.EBOOK_TEST_DATABASE_URL;
process.env.ADMIN_EMAILS = "ebook-owner@example.com";
process.env.AUTH_SECRET = "ebook-integration-only-secret";
process.env.NODE_ENV = "test";
const jwt = require("jsonwebtoken");
const db = require("../src/config/database"),
  seeds = require("../content/ebooks-starter.json");
const app = require("../src/app");
let server, base;
const users = {
  owner: "ebook-owner@example.com",
  reader: "ebook-reader@example.com",
  editor: "ebook-editor@example.com",
  other: "ebook-other@example.com",
};
function token(who) {
  return jwt.sign(
    {
      sub: who,
      email: users[who],
      name: `Ebook ${who}`,
      provider: "google",
      emailVerified: true,
    },
    process.env.AUTH_SECRET,
    { expiresIn: "1h" },
  );
}
async function call(path, who, method = "GET", body) {
  const response = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(who ? { Authorization: "Bearer " + token(who) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}
const book = () => ({
  ...structuredClone(seeds[0]),
  slug: "restricted-learning",
  visibility: "admin_only",
});
test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});
test("seed migration is idempotent and reader APIs strip answer keys and owner contact details", async () => {
  const { seedEbooks } = require("../src/db/seed-ebooks");
  await seedEbooks(db);
  await seedEbooks(db);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM ebooks")).rows[0].n,
    10,
  );
  const list = await call("/ebooks");
  assert.equal(list.status, 200);
  assert.equal(list.json.data.ebooks.length, 10);
  assert.equal(list.json.data.ebooks[0].chapters, undefined);
  const read = await call("/ebooks/python-mastery");
  assert.equal(read.status, 200);
  assert.equal(read.json.data.ebook.finalExamQuestions, undefined);
  assert.equal(read.json.data.ebook.ownerEmail, undefined);
  const edited = await call("/ebooks/python-mastery", "owner");
  assert.equal(edited.json.data.ebook.finalExamQuestions.length, 15);
});
test("private content is hidden, invite reads require approval, and approval uses verified identity", async () => {
  assert.equal(
    (await call("/admin/ebooks", "reader", "POST", book())).status,
    403,
  );
  assert.equal(
    (await call("/admin/ebooks", "owner", "POST", book())).status,
    200,
  );
  assert.equal(
    (await call("/ebooks/restricted-learning", "reader")).status,
    404,
  );
  assert.equal(
    (
      await call(
        "/ebooks/restricted-learning/request-access",
        "reader",
        "POST",
        { note: "Please approve", email: users.owner },
      )
    ).status,
    404,
  );
  let draft = (await call("/ebooks/restricted-learning", "owner")).json.data
    .ebook;
  draft.visibility = "invite_only";
  assert.equal(
    (await call("/admin/ebooks/restricted-learning", "owner", "PUT", draft))
      .status,
    200,
  );
  const denied = await call("/ebooks/restricted-learning", "reader");
  assert.equal(denied.status, 403);
  assert.equal(denied.json.data, undefined);
  assert.equal(
    (
      await call(
        "/ebooks/restricted-learning/request-access",
        "reader",
        "POST",
        { note: "Need this track", email: users.owner, role: "editor" },
      )
    ).status,
    200,
  );
  const queue = (await call("/admin/ebooks/requests", "owner")).json.data
    .requests;
  assert.equal(queue[0].email, users.reader);
  assert.equal(queue[0].role, "reader");
  assert.equal(
    (
      await call(
        "/admin/ebooks/restricted-learning/approve-access",
        "reader",
        "POST",
        { email: users.reader, role: "editor", status: "approved" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/admin/ebooks/restricted-learning/approve-access",
        "owner",
        "POST",
        { email: users.reader, role: "reader", status: "approved" },
      )
    ).status,
    200,
  );
  const visible = await call("/ebooks/restricted-learning", "reader");
  assert.equal(visible.status, 200);
  assert.equal(visible.json.data.ebook.permissions.canEdit, false);
  assert.equal(visible.json.data.ebook.finalExamQuestions, undefined);
  assert.equal(
    (
      await call(
        "/admin/ebooks/restricted-learning",
        "reader",
        "PUT",
        visible.json.data.ebook,
      )
    ).status,
    403,
  );
});
test("approved editors edit content but cannot create books, change visibility, approve or archive", async () => {
  await call(
    "/admin/ebooks/restricted-learning/approve-access",
    "owner",
    "POST",
    { email: users.editor, role: "editor", status: "approved" },
  );
  const current = (await call("/ebooks/restricted-learning", "editor")).json
    .data.ebook;
  assert.equal(current.permissions.canEdit, true);
  assert.equal(current.permissions.canManageAccess, false);
  assert.equal(
    (
      await call("/admin/ebooks", "editor", "POST", {
        ...book(),
        slug: "editor-created",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/admin/ebooks/restricted-learning", "editor", "PUT", {
        ...current,
        title: "Edited learning track",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/admin/ebooks/restricted-learning", "editor", "PUT", current))
      .status,
    409,
  );
  const fresh = (await call("/ebooks/restricted-learning", "editor")).json.data
    .ebook;
  assert.equal(
    (
      await call("/admin/ebooks/restricted-learning", "editor", "PUT", {
        ...fresh,
        visibility: "public",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/admin/ebooks/restricted-learning", "editor", "DELETE"))
      .status,
    403,
  );
  assert.equal((await call("/admin/ebooks/requests", "editor")).status, 403);
});
test("progress is scoped to account and revocation blocks reading, saving, editing and exam start", async () => {
  await call("/ebooks/restricted-learning/progress", "reader", "PUT", {
    completed: ["python-model"],
    bookmark: "python-model",
  });
  assert.deepEqual(
    (await call("/ebooks/restricted-learning/progress", "reader")).json.data
      .completed,
    ["python-model"],
  );
  assert.deepEqual(
    (await call("/ebooks/restricted-learning/progress", "editor")).json.data
      .completed,
    [],
  );
  await call(
    "/admin/ebooks/restricted-learning/approve-access",
    "owner",
    "POST",
    { email: users.reader, role: "reader", status: "revoked" },
  );
  assert.equal(
    (await call("/ebooks/restricted-learning", "reader")).status,
    403,
  );
  assert.equal(
    (
      await call("/ebooks/restricted-learning/progress", "reader", "PUT", {
        completed: [],
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/ebooks/restricted-learning/attempts", "reader", "POST", {}))
      .status,
    403,
  );
  assert.equal(
    (await call("/ebooks/restricted-learning/practice", "reader")).status,
    403,
  );
});
test("timed exams hide keys, enforce ownership, grade saved snapshots and submit idempotently", async () => {
  const started = await call(
    "/ebooks/python-mastery/attempts",
    "reader",
    "POST",
    { negativeMarking: false },
  );
  assert.equal(started.status, 200);
  const attempt = started.json.data.attempt,
    id = attempt.id;
  assert.ok(
    attempt.questions.every(
      (q) => q.answer === undefined && q.explanation === undefined,
    ),
  );
  assert.equal((await call("/ebooks/attempts/" + id, "other")).status, 404);
  const answers = Object.fromEntries(
    seeds[0].finalExamQuestions.map((q) => [q.id, q.answer]),
  );
  assert.equal(
    (
      await call("/ebooks/attempts/" + id, "reader", "PUT", {
        answers: { unknown: 0 },
      })
    ).status,
    400,
  );
  const finished = await call(
    "/ebooks/attempts/" + id + "/submit",
    "reader",
    "POST",
    { answers, percentage: 0, passed: false },
  );
  assert.equal(finished.json.data.attempt.result.percentage, 100);
  const again = await call(
    "/ebooks/attempts/" + id + "/submit",
    "reader",
    "POST",
    { answers: {} },
  );
  assert.equal(again.json.data.attempt.result.percentage, 100);
  assert.equal((await call("/ebooks/certificates/" + id)).status, 404);
  assert.equal(
    (await call("/ebooks/attempts/" + id + "/share", "other", "POST", {}))
      .status,
    404,
  );
  assert.equal(
    (await call("/ebooks/attempts/" + id + "/share", "reader", "POST", {}))
      .status,
    200,
  );
  const shared = (await call("/ebooks/certificates/" + id)).json.data
    .certificate;
  assert.equal(shared.name, "Ebook reader");
  assert.equal(shared.percentage, 100);
  assert.equal(shared.email, undefined);
  assert.ok(
    (await call("/ebooks/attempts", "reader")).json.data.attempts.some(
      (a) => a.id === id,
    ),
  );
});
test("expired submissions ignore late answers and read-only results survive an API restart", async () => {
  const start = (
    await call("/ebooks/python-mastery/attempts", "reader", "POST", {})
  ).json.data.attempt;
  const q = seeds[0].finalExamQuestions[0];
  await call("/ebooks/attempts/" + start.id, "reader", "PUT", {
    answers: { [q.id]: q.answer },
  });
  await db.query(
    "UPDATE ebook_attempts SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
    [start.id],
  );
  assert.equal(
    (
      await call("/ebooks/attempts/" + start.id, "reader", "PUT", {
        answers: { [q.id]: 3 },
      })
    ).status,
    409,
  );
  const answers = Object.fromEntries(
    seeds[0].finalExamQuestions.map((q) => [q.id, q.answer]),
  );
  const finished = await call(
    "/ebooks/attempts/" + start.id + "/submit",
    "reader",
    "POST",
    { answers },
  );
  assert.equal(finished.json.data.attempt.result.correct, 1);
  const dbUser = (
    await db.query("SELECT id FROM users WHERE email=$1", [users.reader])
  ).rows[0];
  const freshService =
    require("../src/services/ebooks.service").createEbooksService(db);
  assert.equal(
    (
      await freshService.attempt(start.id, {
        id: dbUser.id,
        email: users.reader,
      })
    ).result.correct,
    1,
  );
});
test("private certificates cannot be published, seed fallbacks cannot be restricted, and archival is durable", async () => {
  let doc = (await call("/ebooks/restricted-learning", "owner")).json.data
    .ebook;
  assert.equal(
    (
      await call("/admin/ebooks/python-mastery", "owner", "PUT", {
        ...(await call("/ebooks/python-mastery", "owner")).json.data.ebook,
        visibility: "admin_only",
      })
    ).status,
    400,
  );
  await call(
    "/admin/ebooks/restricted-learning/approve-access",
    "owner",
    "POST",
    { email: users.reader, role: "reader", status: "approved" },
  );
  const started = (
    await call("/ebooks/restricted-learning/attempts", "reader", "POST", {})
  ).json.data.attempt;
  const answers = Object.fromEntries(
    seeds[0].finalExamQuestions.map((q, i) => [
      `restricted-learning-q${i + 1}`,
      q.answer,
    ]),
  );
  await call("/ebooks/attempts/" + started.id + "/submit", "reader", "POST", {
    answers,
  });
  assert.equal(
    (
      await call(
        "/ebooks/attempts/" + started.id + "/share",
        "reader",
        "POST",
        {},
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/admin/ebooks/restricted-learning", "owner", "DELETE")).status,
    200,
  );
  assert.equal(
    (await call("/ebooks/restricted-learning", "owner")).status,
    404,
  );
});

test("PDF uploads persist, require revisions, and recheck reader/editor access on every retrieval", async () => {
  const slug = "private-pdf-track";
  let current = (
    await call("/admin/ebooks", "owner", "POST", { ...book(), slug })
  ).json.data.ebook;
  const bytes = Buffer.from("%PDF-1.4\n% test-only fixture\n%%EOF");
  const upload = async (who, body = bytes, revision = current.revision) => {
    const response = await fetch(
      base +
        "/api/v1/admin/ebooks/" +
        slug +
        "/pdf?filename=study.pdf&revision=" +
        revision,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          ...(who ? { Authorization: "Bearer " + token(who) } : {}),
        },
        body,
      },
    );
    return { status: response.status, json: await response.json() };
  };
  const get = async (who, download = "") =>
    fetch(base + "/api/v1/ebooks/" + slug + "/pdf" + download, {
      headers: who ? { Authorization: "Bearer " + token(who) } : {},
    });
  assert.equal((await upload()).status, 401);
  assert.equal((await upload("reader")).status, 403);
  assert.equal((await upload("owner", Buffer.from("not a pdf"))).status, 400);
  const saved = await upload("owner");
  assert.equal(saved.status, 200);
  assert.equal(saved.json.data.ebook.revision, current.revision + 1);
  assert.equal((await upload("owner")).status, 409);
  current = saved.json.data.ebook;
  assert.equal((await get()).status, 404);
  assert.equal((await get("reader")).status, 404);
  let response = await get("owner");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  assert.match(response.headers.get("cache-control"), /private/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  current = (
    await call("/admin/ebooks/" + slug, "owner", "PUT", {
      ...current,
      visibility: "invite_only",
      allowPdfDownload: false,
    })
  ).json.data.ebook;
  assert.equal((await get("reader")).status, 403);
  for (const who of ["reader", "editor"])
    assert.equal(
      (
        await call(
          "/admin/ebooks/" + slug + "/approve-access",
          "owner",
          "POST",
          {
            email: users[who],
            role: who === "editor" ? "editor" : "reader",
            status: "approved",
          },
        )
      ).status,
      200,
    );
  assert.equal((await get("reader")).status, 200);
  assert.equal((await get("reader", "?download=1")).status, 403);
  assert.equal((await upload("reader")).status, 403);
  let edited = await upload("editor");
  assert.equal(edited.status, 200);
  current = edited.json.data.ebook;
  await call("/admin/ebooks/" + slug + "/approve-access", "owner", "POST", {
    email: users.editor,
    role: "editor",
    status: "revoked",
  });
  assert.equal((await get("editor")).status, 403);
  assert.equal((await upload("editor")).status, 403);
  const tooLarge = await upload(
    "owner",
    Buffer.concat([bytes, Buffer.alloc(3 * 1024 * 1024)]),
  );
  assert.equal(tooLarge.status, 413);
  const detached = await call("/admin/ebooks/" + slug, "owner", "PUT", {
    ...current,
    pdfUrl: "",
    pdfFileName: "",
  });
  assert.equal(detached.status, 200);
  assert.equal((await get("owner")).status, 404);
});
test("configured exam scoring survives later edits and API recreation", async () => {
  const slug = "configured-score-track";
  let current = (
    await call("/admin/ebooks", "owner", "POST", {
      ...book(),
      slug,
      passPercent: 80,
      marksPerCorrect: 2,
      negativeMarks: 0.25,
      finalExamQuestions: seeds[0].finalExamQuestions
        .slice(0, 5)
        .map((q, i) => ({ ...q, domain: i < 3 ? "Core" : "Application" })),
    })
  ).json.data.ebook;
  const started = await call(
    "/ebooks/" + slug + "/attempts",
    "owner",
    "POST",
    {},
  );
  assert.equal(started.status, 200);
  const attempt = started.json.data.attempt;
  assert.equal(attempt.negativeMarks, 0.25);
  assert.equal(attempt.passPercent, 80);
  assert.equal(attempt.marksPerCorrect, 2);
  assert.equal(
    (
      await call("/admin/ebooks/" + slug, "owner", "PUT", {
        ...current,
        passPercent: 20,
        marksPerCorrect: 1,
      })
    ).status,
    200,
  );
  const answers = Object.fromEntries(
    current.finalExamQuestions.map((q, i) => [
      q.id,
      i === 4 ? (q.answer + 1) % 4 : q.answer,
    ]),
  );
  const submitted = await call(
    "/ebooks/attempts/" + attempt.id + "/submit",
    "owner",
    "POST",
    { answers },
  );
  assert.equal(submitted.status, 200);
  assert.equal(submitted.json.data.attempt.result.percentage, 77.5);
  assert.equal(submitted.json.data.attempt.result.passed, false);
  assert.equal(submitted.json.data.attempt.result.maxScore, 10);
  assert.equal(submitted.json.data.attempt.result.domains.length, 2);
  const service = require("../src/services/ebooks.service").createEbooksService(
    db,
  );
  const row = (
    await db.query("SELECT user_id FROM ebook_attempts WHERE id=$1", [
      attempt.id,
    ])
  ).rows[0];
  const persisted = await service.attempt(attempt.id, {
    id: row.user_id,
    email: users.owner,
  });
  assert.equal(persisted.result.passPercent, 80);
  assert.equal(persisted.result.percentage, 77.5);
});
