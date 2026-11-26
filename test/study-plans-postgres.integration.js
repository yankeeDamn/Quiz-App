"use strict";
// Explicit disposable database only; never falls back to DATABASE_URL.
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
if (!process.env.STUDY_TEST_DATABASE_URL)
  throw Error(
    "STUDY_TEST_DATABASE_URL must point to a disposable local/staging database",
  );
process.env.DATABASE_URL = process.env.STUDY_TEST_DATABASE_URL;
process.env.ADMIN_EMAILS = "study-owner@example.test";
process.env.AUTH_SECRET = "study-test-only-secret";
process.env.NODE_ENV = "test";
const db = require("../src/config/database"),
  app = require("../src/app"),
  jwt = require("jsonwebtoken");
const { PDFDocument } = require("pdf-lib");
const service = require("../src/services/study-plans.service");
let server, base;
const identities = {};
function token(who) {
  return jwt.sign(
    {
      sub: who,
      email: `study-${who}@example.test`,
      name: who,
      provider: "google",
      emailVerified: true,
    },
    process.env.AUTH_SECRET,
    { expiresIn: "1h" },
  );
}
async function call(path, who, method = "GET", body) {
  const r = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      ...(who ? { Authorization: "Bearer " + token(who) } : {}),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: r.headers.get("content-type")?.includes("application/json")
      ? await r.json()
      : Buffer.from(await r.arrayBuffer()),
  };
}
async function admin(path, body, method = "POST") {
  const r = await call("/admin/study-plans" + path, "owner", method, body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.data;
}
test.before(async () => {
  await db.query(fs.readFileSync("src/db/study-plans.sql", "utf8"));
  await db.query(fs.readFileSync("src/db/study-plans.sql", "utf8"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const who of [
    "owner",
    "free",
    "pro",
    "other",
    "expired",
    "pass",
    "revoked",
  ]) {
    await call("/user/profile", who);
    identities[who] = (
      await db.query("SELECT * FROM users WHERE email=$1", [
        `study-${who}@example.test`,
      ])
    ).rows[0];
  }
  for (const who of ["pro", "other"])
    await db.query(
      "UPDATE users SET plan='pro',plan_expires_at=now()+interval '30 days' WHERE id=$1",
      [identities[who].id],
    );
  await db.query(
    "UPDATE users SET plan='pro',plan_expires_at=now()-interval '1 day' WHERE id=$1",
    [identities.expired.id],
  );
  for (const [who, code] of [
    ["pass", "SSC_PACK_49"],
    ["pass", "IT_EBOOK_PACK_99"],
    ["revoked", "PRO_MONTHLY"],
  ])
    await db.query(
      "INSERT INTO monetization_grants(user_id,code,expires_at,reference,granted_by) VALUES($1,$2,now()+interval '30 days',$3,'test')",
      [identities[who].id, code, who + code],
    );
});
test.after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((r) => server.close(r));
  await db.end();
});
test("Study Plans lifecycle, API authorization and existing content integration", async (t) => {
  let sy, topic, plan, preview, paid, resource, question;
  await t.test(
    "ordinary students and guests cannot manage content",
    async () => {
      assert.equal((await call("/admin/study-plans", "free")).status, 403);
      assert.equal((await call("/admin/study-plans")).status, 401);
    },
  );
  await t.test(
    "admin builds an editable draft and stable syllabus hierarchy",
    async () => {
      await admin("/exams", {
        id: "ssc-cgl",
        name: "SSC CGL",
        status: "published",
      });
      sy = await admin("/syllabuses", {
        exam_id: "ssc-cgl",
        version: "TEST-ONLY",
        source_url: "https://ssc.gov.in/",
        verified: true,
        pattern_reference:
          "Synthetic fixture, not a verified production syllabus",
      });
      let parent = null;
      for (const kind of ["stage", "subject", "chapter", "topic"]) {
        topic = await admin("/topics", {
          syllabus_id: sy.id,
          parent_id: parent,
          kind,
          name: "Fixture " + kind,
          status: "published",
        });
        parent = topic.id;
      }
      topic = await admin(
        "/topics/" + topic.id,
        { ...topic, display_order: 7 },
        "PUT",
      );
      assert.equal(topic.display_order, 7);
      plan = await admin("/plans", {
        slug: "ssc-cgl",
        exam_id: "ssc-cgl",
        syllabus_id: sy.id,
        title: "Test fixture plan",
        duration: 2,
        daily_minutes: 60,
      });
      plan = await admin(
        "/plans/" + plan.id,
        { ...plan, description: "Changed draft" },
        "PUT",
      );
      assert.equal((await call("/study-plans/ssc-cgl", "pro")).status, 404);
      assert.equal((await call("/study-plans")).data.data.plans.length, 0);
      assert.equal(
        (await call(`/admin/study-plans/plans/${plan.id}/preview`, "owner"))
          .status,
        200,
      );
    },
  );
  await t.test(
    "private PDF reuses Ebook Studio and remains Pro-only on every direct alias",
    async () => {
      const book = {
        ...structuredClone(require("../content/ebooks-starter.json")[0]),
        slug: "study-test-guide",
        visibility: "admin_only",
        accessLevel: "pro",
        isBundledPublicEdition: false,
        studyProOnly: true,
        pdfUrl: null,
      };
      // Create through existing service, upload with its bounded PDF validation.
      const books = require("../src/services/ebooks.service");
      const owner = { ...identities.owner, email: "study-owner@example.test" };
      const created = await books.save(book.slug, book, owner, true);
      await assert.rejects(
        books.uploadPdf(
          book.slug,
          owner,
          Buffer.from("not a pdf"),
          "bad.pdf",
          created.revision,
        ),
        /PDF/,
      );
      const pdf = await PDFDocument.create();
      for (let i = 0; i < 4; i++) pdf.addPage();
      const bytes = Buffer.from(await pdf.save());
      const uploaded = await books.uploadPdf(
        book.slug,
        owner,
        bytes,
        "fixture.pdf",
        created.revision,
      );
      await books.updateVisibility(
        book.slug,
        { revision: uploaded.revision, visibility: "public" },
        owner,
      );
      resource = await admin("/resources", {
        exam_id: "ssc-cgl",
        topic_id: topic.id,
        title: "Fixture PDF",
        kind: "notes",
        ebook_slug: book.slug,
        attribution: "Original test fixture",
        rights_notes: "Generated locally for tests",
        access_policy: "pro",
        status: "published",
      });
      for (const who of ["free", "expired", "pass", "revoked"])
        for (const alias of ["pdf", "read", "download"]) {
          const r = await call(`/ebooks/${book.slug}/${alias}`, who);
          if (alias === "download") {
            assert.equal(r.status, 403);
            continue;
          }
          assert.equal(r.status, 200);
          assert.equal((await PDFDocument.load(r.data)).getPageCount(), 2);
        }
    },
  );
  await t.test(
    "validated PYQ import is atomic, duplicates rejected, existing IDs linked",
    async () => {
      await db.query(
        "INSERT INTO mock_topics(id,name,category) VALUES('study-fixture','Fixture','Test')",
      );
      const q = {
        question: "Synthetic fixture: two plus two?",
        options: ["1", "2", "3", "4"],
        answer: 3,
        explanation: "Two plus two equals four.",
        pyq: { exam_id: "ssc-cgl", topic_id: topic.id },
      };
      const inspect = await admin("/pyqs/import/study-fixture/preview", {
        rows: [q],
      });
      assert.equal(inspect.valid, true);
      const imported = await admin("/pyqs/import/study-fixture/commit", {
        rows: [q],
        previewed: true,
      });
      assert.equal(imported.added, 1);
      const duplicate = await admin("/pyqs/import/study-fixture/commit", {
        rows: [q],
        previewed: true,
      });
      assert.equal(duplicate.valid, false);
      const bad = await admin("/pyqs/import/study-fixture/preview", {
        rows: [{ ...q, answer: null }],
      });
      assert.equal(bad.valid, false);
      assert.match(bad.errors[0].message, /integer/);
      question = (
        await db.query(
          "SELECT * FROM mock_questions WHERE topic_id='study-fixture'",
        )
      ).rows[0];
      assert.equal(
        (
          await db.query(
            "SELECT verification FROM study_pyq_metadata WHERE question_id=$1",
            [question.id],
          )
        ).rows[0].verification,
        "unverified",
      );
      await admin(
        "/pyqs/" + question.id,
        {
          exam_id: "ssc-cgl",
          topic_id: topic.id,
          exam_year: 2026,
          stage: "TEST",
          source: "Synthetic integration fixture only",
          rights_notes: "Original arithmetic fixture",
          verification: "verified",
        },
        "PUT",
      );
      await db.query(
        "UPDATE mock_questions SET review_status='published',access_tier='free' WHERE id=$1",
        [question.id],
      );
      preview = await admin(`/plans/${plan.id}/tasks`, {
        day: 1,
        title: "Free fixture task",
        description: "Preview guidance",
        kind: "pyq",
        minutes: 10,
        preview: true,
        topic_id: topic.id,
        question_ids: [question.id],
      });
      paid = await admin(`/plans/${plan.id}/tasks`, {
        day: 2,
        title: "Paid fixture task",
        description: "PRIVATE GUIDANCE",
        kind: "pdf",
        minutes: 20,
        resource_id: resource.id,
        topic_id: topic.id,
      });
      const reorder = await admin(
        `/plans/${plan.id}/tasks/${paid.id}`,
        { ...paid, display_order: 5, question_ids: [] },
        "PUT",
      );
      assert.equal(reorder.display_order, 5);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM mock_questions WHERE topic_id='study-fixture'",
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "explicit publication gates content and Free preview never returns premium tasks",
    async () => {
      const current = await admin("/plans/" + plan.id, undefined, "GET");
      assert.equal(
        (
          await call(
            `/admin/study-plans/plans/${plan.id}/publish`,
            "owner",
            "POST",
            { revision: current.revision },
          )
        ).status,
        400,
      );
      await admin(`/plans/${plan.id}/publish`, {
        revision: current.revision,
        acknowledged: true,
      });
      assert.equal((await call("/study-plans")).data.data.plans.length, 1);
      for (const who of [undefined, "free", "expired", "pass", "revoked"]) {
        const d = await call("/study-plans/ssc-cgl/day/2", who);
        assert.equal(d.status, 200);
        assert.deepEqual(d.data.data.tasks, []);
        assert.ok(!JSON.stringify(d.data).includes("PRIVATE GUIDANCE"));
        assert.equal(
          (await call(`/study-plans/ssc-cgl/tasks/${paid.id}/resource`, who))
            .status,
          403,
        );
        assert.equal(
          (await call("/study-plans/ssc-cgl/day/1", who)).data.data.tasks
            .length,
          1,
        );
      }
      assert.equal(
        (await call("/study-plans/ssc-cgl/day/2", "pro")).data.data.tasks[0]
          .description,
        "PRIVATE GUIDANCE",
      );
      const asset = await call(
        `/study-plans/ssc-cgl/tasks/${paid.id}/resource`,
        "pro",
      );
      assert.equal(asset.status, 200);
      assert.equal((await PDFDocument.load(asset.data)).getPageCount(), 4);
      const answer = await call(
        `/study-plans/ssc-cgl/tasks/${preview.id}/questions/${question.id}/answer`,
        "free",
        "POST",
        { answer: 3 },
      );
      assert.equal(answer.data.data.correct, true);
    },
  );
  await t.test(
    "enrollment, completion, resume and ownership persist across independent requests",
    async () => {
      assert.equal(
        (
          await call("/study-plans/ssc-cgl/enroll", "free", "POST", {
            start_date: "2026-01-01",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await call("/study-plans/ssc-cgl/enroll", "pro", "POST", {
            start_date: "2026-02-31",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/study-plans/ssc-cgl/enroll", "pro", "POST", {
            start_date: "2026-01-01",
          })
        ).status,
        200,
      );
      const completed = await call(
        `/study-plans/ssc-cgl/tasks/${paid.id}/complete`,
        "pro",
        "PUT",
        { completed: true, user_id: identities.other.id },
      );
      assert.equal(completed.status, 200);
      assert.equal(completed.data.data.percentage, 50);
      const again = await call(
        `/study-plans/ssc-cgl/tasks/${paid.id}/complete`,
        "pro",
        "PUT",
        { completed: true },
      );
      assert.equal(again.data.data.percentage, 50);
      assert.equal(
        (await call("/study-plans/ssc-cgl", "pro")).data.data.progress
          .completed,
        1,
      );
      assert.equal(
        (await call("/study-plans/ssc-cgl", "other")).data.data.progress,
        null,
      );
      assert.equal(
        (
          await call(
            `/study-plans/ssc-cgl/tasks/${paid.id}/complete`,
            "other",
            "PUT",
            { completed: true },
          )
        ).status,
        404,
      );
      const count = await db.query(
        "SELECT count(*)::int AS n FROM study_completions WHERE user_id=$1",
        [identities.other.id],
      );
      assert.equal(count.rows[0].n, 0);
    },
  );
  await t.test(
    "published editions cannot be edited; cloning and archival retain enrollment records",
    async () => {
      assert.equal(
        (
          await call(
            `/admin/study-plans/plans/${plan.id}/tasks`,
            "owner",
            "POST",
            { day: 1, title: "Edit", kind: "reading", minutes: 10 },
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/admin/study-plans/topics/" + topic.id,
            "owner",
            "PUT",
            topic,
          )
        ).status,
        409,
      );
      const cloned = await admin(`/plans/${plan.id}/clone`, {});
      assert.equal(cloned.edition, 2);
      assert.equal(cloned.status, "draft");
      assert.equal(
        (await call("/study-plans/ssc-cgl", "pro")).data.data.edition,
        1,
      );
      await admin(`/plans/${plan.id}/archive`, {});
      assert.equal((await call("/study-plans/ssc-cgl", "pro")).status, 404);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM study_completions WHERE user_id=$1",
            [identities.pro.id],
          )
        ).rows[0].n,
        1,
      );
    },
  );
});
