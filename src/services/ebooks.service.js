"use strict";
const database = require("../config/database");
const config = require("../config");
const seeds = require("../../content/ebooks-starter.json");
const CATEGORIES = [
  "Python",
  "AI with Copilot",
  "Python & Cheatcodes",
  "Machine Learning",
  "LLMs & Hugging Face",
  "GitHub Copilot (GH-300)",
  "Endpoint Admin (MD-102)",
  "Java",
  "Cloud & DevOps",
];
const SEEDS = new Set(seeds.map((book) => book.slug));
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function fail(message, statusCode = 400, code = "EBOOK_INVALID") {
  throw Object.assign(new Error(message), { statusCode, code });
}
const emailOf = (user) =>
  String(user?.email || "")
    .trim()
    .toLowerCase();
const isOwnerAdmin = (user) =>
  !!emailOf(user) && config.adminEmails.includes(emailOf(user));
function permissions(book, user, access) {
  const owner = isOwnerAdmin(user);
  const approved = access?.status === "approved";
  return {
    canRead:
      owner ||
      book.visibility === "public" ||
      (book.visibility === "invite_only" && approved),
    canEdit:
      owner ||
      (book.visibility !== "admin_only" &&
        approved &&
        access.role === "editor"),
    canManageAccess: owner,
  };
}
function text(value, min, max, label) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function question(raw, id) {
  if (!raw || !Array.isArray(raw.options) || raw.options.length !== 4)
    fail("Every question needs four options.");
  if (!Number.isInteger(raw.answer) || raw.answer < 0 || raw.answer > 3)
    fail("Answer must be an option index from 0 to 3.");
  return {
    id,
    ...(raw.domain
      ? { domain: text(raw.domain, 1, 180, "Question domain") }
      : {}),
    question: text(raw.question, 5, 3000, "Question"),
    options: raw.options.map((option) => text(option, 1, 1000, "Option")),
    answer: raw.answer,
    explanation: text(raw.explanation, 5, 3000, "Explanation"),
  };
}
function validateBook(raw, slug) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("Ebook must be an object.");
  if (["capabilities", "attempts", "certificates", "requests"].includes(slug))
    fail("This slug is reserved for the learning API.");
  if (!SLUG.test(slug))
    fail("Use a slug of 2–60 lowercase letters, digits and dashes.");
  if (!["admin_only", "invite_only", "public"].includes(raw.visibility))
    fail("Unknown visibility.");
  if (!CATEGORIES.includes(raw.category)) fail("Unknown category.");
  if (
    ![
      "Beginner to Pro",
      "Intermediate",
      "Advanced",
      "Certification Cram",
    ].includes(raw.level)
  )
    fail("Unknown level.");
  if (
    !Array.isArray(raw.chapters) ||
    raw.chapters.length < 1 ||
    raw.chapters.length > 50
  )
    fail("Add 1–50 chapters.");
  if (
    !Array.isArray(raw.finalExamQuestions) ||
    raw.finalExamQuestions.length < 1 ||
    raw.finalExamQuestions.length > 100
  )
    fail("Add 1–100 final exam questions.");
  const ids = new Set();
  const chapters = raw.chapters.map((chapter, order) => {
    const id = text(chapter.id, 2, 60, "Chapter ID");
    if (!SLUG.test(id) || ids.has(id))
      fail("Chapter IDs must be unique lowercase slugs.");
    ids.add(id);
    if (
      !Number.isInteger(chapter.durationMinutes) ||
      chapter.durationMinutes < 1 ||
      chapter.durationMinutes > 240
    )
      fail("Chapter duration must be 1–240 minutes.");
    if (
      !Array.isArray(chapter.keyTakeaways) ||
      chapter.keyTakeaways.length < 1 ||
      chapter.keyTakeaways.length > 12
    )
      fail("Add 1–12 takeaways per chapter.");
    if (
      !Array.isArray(chapter.conceptChecks) ||
      chapter.conceptChecks.length !== 2
    )
      fail("Add exactly two concept checks per chapter.");
    let codeSnippet;
    if (chapter.codeSnippet) {
      if (
        ![
          "python",
          "java",
          "typescript",
          "bash",
          "powershell",
          "json",
        ].includes(chapter.codeSnippet.language)
      )
        fail("Unsupported snippet language.");
      codeSnippet = {
        language: chapter.codeSnippet.language,
        code: text(chapter.codeSnippet.code, 1, 15000, "Code"),
        expectedOutput: text(
          chapter.codeSnippet.expectedOutput,
          0,
          10000,
          "Expected output",
        ),
      };
    }
    return {
      id,
      order,
      title: text(chapter.title, 3, 180, "Chapter title"),
      durationMinutes: chapter.durationMinutes,
      summary: text(chapter.summary, 0, 500, "Chapter summary"),
      contentMarkdown: text(
        chapter.contentMarkdown,
        20,
        40000,
        "Chapter content",
      ),
      codeSnippet,
      keyTakeaways: chapter.keyTakeaways.map((tip) =>
        text(tip, 3, 1000, "Takeaway"),
      ),
      conceptChecks: chapter.conceptChecks.map((check, i) =>
        question(check, `${id}-check-${i}`),
      ),
    };
  });
  const minutes = Number(raw.examMinutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180)
    fail("Exam duration must be 1–180 minutes.");
  const linkedMockTestId = raw.linkedMockTestId
    ? text(raw.linkedMockTestId, 2, 60, "Mock test ID")
    : "";
  if (linkedMockTestId && !SLUG.test(linkedMockTestId))
    fail("Invalid linked test ID.");
  const passPercent = raw.passPercent ?? 70,
    marksPerCorrect = raw.marksPerCorrect ?? 1,
    negativeMarks = raw.negativeMarks ?? 0;
  if (
    !Number.isFinite(passPercent) ||
    passPercent < 1 ||
    passPercent > 100 ||
    !Number.isFinite(marksPerCorrect) ||
    marksPerCorrect <= 0 ||
    marksPerCorrect > 10 ||
    ![0, 0.25].includes(negativeMarks)
  )
    fail("Invalid pass percentage or marking settings.");
  if (
    raw.allowPdfDownload !== undefined &&
    typeof raw.allowPdfDownload !== "boolean"
  )
    fail("PDF download setting must be boolean.");
  let pdfUrl = raw.pdfUrl || "";
  if (pdfUrl && pdfUrl !== `/api/v1/ebooks/${slug}/pdf`) {
    let url;
    try {
      url = new URL(pdfUrl);
    } catch {
      fail("Use an HTTPS PDF URL.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.pathname.toLowerCase().endsWith(".pdf")
    )
      fail("Use an HTTPS link ending in .pdf without embedded credentials.");
    if (raw.visibility !== "public")
      fail(
        "Restricted books require an authenticated PDF upload. Remove the external PDF before restricting visibility.",
      );
    pdfUrl = url.href;
  }
  return {
    passPercent,
    marksPerCorrect,
    negativeMarks,
    allowPdfDownload: raw.allowPdfDownload !== false,
    isCheatSheet: raw.isCheatSheet === true,
    pdfUrl,
    pdfFileName: text(raw.pdfFileName || "", 0, 180, "PDF filename"),
    examBadgeCode: text(raw.examBadgeCode || "", 0, 40, "Badge code"),
    version: text(raw.version || "1.0", 1, 40, "Version"),
    slug,
    title: text(raw.title, 3, 180, "Title"),
    subtitle: text(raw.subtitle, 3, 1000, "Summary"),
    category: raw.category,
    level: raw.level,
    visibility: raw.visibility,
    chapters,
    linkedMockTestId,
    examMinutes: minutes,
    examId: seeds.find((book) => book.slug === slug)?.examId || `ebook-${slug}`,
    examTitle:
      seeds.find((book) => book.slug === slug)?.examTitle ||
      "Final Skill Assessment",
    finalExamQuestions: raw.finalExamQuestions.map((q, i) =>
      question(q, `${slug}-q${i + 1}`),
    ),
    references: Array.isArray(raw.references)
      ? raw.references
          .filter(
            (link) => typeof link === "string" && /^https:\/\//.test(link),
          )
          .slice(0, 10)
      : [],
  };
}
function grade(snapshot, answers, negativeMarks) {
  let correct = 0,
    wrong = 0;
  const review = snapshot.finalExamQuestions.map((q) => {
    const selected = Number.isInteger(answers[q.id]) ? answers[q.id] : -1;
    if (selected === q.answer) correct++;
    else if (selected >= 0) wrong++;
    return { ...q, selected };
  });
  const total = review.length,
    score = Math.max(
      0,
      correct * (snapshot.marksPerCorrect ?? 1) - wrong * Number(negativeMarks),
    );
  const maxScore = total * (snapshot.marksPerCorrect ?? 1);
  const percentage = Math.round((score / maxScore) * 10000) / 100;
  return {
    score,
    total,
    correct,
    wrong,
    unanswered: total - correct - wrong,
    percentage,
    passed: percentage >= (snapshot.passPercent ?? 70),
    maxScore,
    passPercent: snapshot.passPercent ?? 70,
    domains: [...new Set(review.map((q) => q.domain).filter(Boolean))].map(
      (domain) => ({
        domain,
        total: review.filter((q) => q.domain === domain).length,
        correct: review.filter(
          (q) => q.domain === domain && q.selected === q.answer,
        ).length,
      }),
    ),
    review,
  };
}
function cleanAnswers(answers, snapshot) {
  if (!answers || Array.isArray(answers) || typeof answers !== "object")
    fail("Answers must be a question-to-option map.");
  const allowed = new Set(snapshot.finalExamQuestions.map((q) => q.id));
  for (const [id, value] of Object.entries(answers))
    if (!allowed.has(id) || !Number.isInteger(value) || value < -1 || value > 3)
      fail("Unknown question or invalid option.");
  return answers;
}
function createEbooksService(db = database, clock = Date.now) {
  const transaction = async (fn) => {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  async function read(slug, user, client = db, lock = false) {
    if (!SLUG.test(slug)) fail("Ebook not found", 404, "BOOK_NOT_FOUND");
    const row = (
      await client.query(
        `SELECT * FROM ebooks WHERE slug=$1 AND NOT archived${lock ? " FOR UPDATE" : ""}`,
        [slug],
      )
    ).rows[0];
    if (!row) fail("Ebook not found", 404, "BOOK_NOT_FOUND");
    const access = emailOf(user)
      ? (
          await client.query(
            "SELECT role,status FROM ebook_access WHERE slug=$1 AND email=$2",
            [slug, emailOf(user)],
          )
        ).rows[0]
      : null;
    const rights = permissions(row, user, access);
    if (!rights.canRead)
      fail(
        row.visibility === "invite_only"
          ? "Access restricted — request admin approval."
          : "Ebook not found",
        row.visibility === "invite_only" ? 403 : 404,
        row.visibility === "invite_only"
          ? "EBOOK_ACCESS_REQUIRED"
          : "BOOK_NOT_FOUND",
      );
    return { row, rights };
  }
  function present(row, rights, summary = false) {
    const { finalExamQuestions, ownerEmail, ...doc } = row.document;
    const value = {
      ...doc,
      visibility: row.visibility,
      revision: row.revision,
      updatedAt: row.updated_at,
      permissions: rights,
      chapterCount: doc.chapters.length,
      durationMinutes: doc.chapters.reduce(
        (sum, c) => sum + c.durationMinutes,
        0,
      ),
      questionCount: finalExamQuestions.length,
    };
    if (summary) delete value.chapters;
    if (rights.canEdit && !summary)
      value.finalExamQuestions = finalExamQuestions;
    return value;
  }
  async function list(user) {
    const rows = (
      await db.query(
        `SELECT b.*, a.role AS access_role,a.status AS access_status FROM ebooks b LEFT JOIN ebook_access a ON a.slug=b.slug AND a.email=$1 WHERE NOT b.archived ORDER BY b.slug LIMIT 200`,
        [emailOf(user)],
      )
    ).rows;
    return rows.flatMap((row) => {
      const rights = permissions(row, user, {
        role: row.access_role,
        status: row.access_status,
      });
      return rights.canRead ? [present(row, rights, true)] : [];
    });
  }
  async function get(slug, user) {
    const { row, rights } = await read(slug, user);
    return present(row, rights);
  }
  async function save(slug, raw, user, create = false) {
    if (create && !isOwnerAdmin(user))
      fail("Only an owner administrator can create ebooks.", 403);
    return transaction(async (client) => {
      let previous;
      if (!create) {
        const current = await read(slug, user, client, true);
        if (!current.rights.canEdit)
          fail("Editing is not approved for this account.", 403);
        previous = current.row;
        if (raw.revision !== previous.revision)
          fail(
            "This ebook changed. Reload before saving to avoid overwriting another editor.",
            409,
            "EBOOK_CONFLICT",
          );
        if (!isOwnerAdmin(user) && raw.visibility !== previous.visibility)
          fail("Only the owner admin can change visibility.", 403);
      }
      const document = validateBook(raw, slug);
      if (
        document.linkedMockTestId &&
        ![
          "az-900",
          "aws-cloud-practitioner",
          "comptia-a-plus",
          "google-cloud-digital-leader",
          "linux-lfcs",
        ].includes(document.linkedMockTestId) &&
        !(
          await client.query("SELECT id FROM mock_tests WHERE id=$1", [
            document.linkedMockTestId,
          ])
        ).rows.length
      )
        fail("Linked mock test ID does not exist.");
      if (SEEDS.has(slug) && document.visibility !== "public")
        fail(
          "Built-in starters are bundled publicly. Create a separate private ebook for restricted material.",
        );
      const updated = {
        ...document,
        ownerEmail: previous?.document.ownerEmail || emailOf(user),
      };
      const result = create
        ? await client.query(
            `INSERT INTO ebooks(slug,document,visibility) VALUES($1,$2,$3) RETURNING *`,
            [slug, JSON.stringify(updated), document.visibility],
          )
        : await client.query(
            `UPDATE ebooks SET document=$2,visibility=$3,revision=revision+1,updated_at=NOW() WHERE slug=$1 RETURNING *`,
            [slug, JSON.stringify(updated), document.visibility],
          );
      return present(
        result.rows[0],
        permissions(result.rows[0], user, {
          role: "editor",
          status: "approved",
        }),
      );
    });
  }
  async function practice(slug, user) {
    const { row } = await read(slug, user);
    return row.document.finalExamQuestions;
  }
  async function archive(slug, user) {
    if (!isOwnerAdmin(user))
      fail("Only the owner admin can archive ebooks.", 403);
    if (SEEDS.has(slug)) fail("Built-in public starters cannot be archived.");
    await read(slug, user);
    await db.query(
      "UPDATE ebooks SET archived=TRUE,revision=revision+1,updated_at=NOW() WHERE slug=$1",
      [slug],
    );
  }
  async function uploadPdf(slug, user, bytes, name, revision) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length > 3 * 1024 * 1024 ||
      bytes.length < 8 ||
      bytes.subarray(0, 5).toString() !== "%PDF-"
    )
      fail("Upload a PDF file of at most 3 MiB.");
    const filename = text(name || "ebook.pdf", 1, 180, "PDF filename").replace(
      /[^a-zA-Z0-9._ -]/g,
      "_",
    );
    return transaction(async (client) => {
      const { row, rights } = await read(slug, user, client, true);
      if (!rights.canEdit)
        fail("Editing is not approved for this account.", 403);
      if (Number(revision) !== row.revision)
        fail(
          "The ebook changed; reload before uploading.",
          409,
          "EBOOK_CONFLICT",
        );
      await client.query(
        `INSERT INTO ebook_pdf_assets(slug,filename,bytes) VALUES($1,$2,$3) ON CONFLICT(slug) DO UPDATE SET filename=$2,bytes=$3,updated_at=NOW()`,
        [slug, filename, bytes],
      );
      const doc = {
        ...row.document,
        pdfUrl: `/api/v1/ebooks/${slug}/pdf`,
        pdfFileName: filename,
      };
      const saved = (
        await client.query(
          "UPDATE ebooks SET document=$2,revision=revision+1,updated_at=NOW() WHERE slug=$1 RETURNING *",
          [slug, JSON.stringify(doc)],
        )
      ).rows[0];
      return present(saved, rights);
    });
  }
  async function pdf(slug, user, download = false) {
    const { row } = await read(slug, user);
    if (
      download &&
      row.document.allowPdfDownload === false &&
      !isOwnerAdmin(user)
    )
      fail("PDF downloading is disabled for this track.", 403);
    if (row.document.pdfUrl !== `/api/v1/ebooks/${slug}/pdf`)
      fail("No uploaded PDF is attached.", 404);
    const asset = (
      await db.query(
        "SELECT filename,bytes FROM ebook_pdf_assets WHERE slug=$1",
        [slug],
      )
    ).rows[0];
    if (!asset) fail("No uploaded PDF is attached.", 404);
    return asset;
  }
  async function requestAccess(slug, user, note) {
    if (!SLUG.test(slug)) fail("Ebook not found", 404);
    const book = (
      await db.query(
        "SELECT visibility FROM ebooks WHERE slug=$1 AND NOT archived",
        [slug],
      )
    ).rows[0];
    if (!book || book.visibility === "admin_only") fail("Ebook not found", 404);
    if (book.visibility !== "invite_only") fail("This book is already public.");
    await db.query(
      `INSERT INTO ebook_access(slug,email,note) VALUES($1,$2,$3) ON CONFLICT(slug,email) DO UPDATE SET note=EXCLUDED.note,requested_at=NOW(),status='pending',role='reader',approved_at=NULL,approved_by=NULL WHERE ebook_access.status IN ('pending','revoked')`,
      [slug, emailOf(user), text(note || "", 0, 1000, "Note")],
    );
  }
  async function accessQueue(user) {
    if (!isOwnerAdmin(user))
      fail("Only an owner administrator can manage access.", 403);
    return (
      await db.query(
        `SELECT a.*, b.document->>'title' AS title FROM ebook_access a JOIN ebooks b ON b.slug=a.slug WHERE NOT b.archived ORDER BY a.requested_at DESC LIMIT 300`,
      )
    ).rows;
  }
  async function approve(slug, user, raw) {
    if (!isOwnerAdmin(user))
      fail("Only an owner administrator can approve access.", 403);
    const email = text(raw.email, 3, 255, "Email").toLowerCase();
    if (
      !EMAIL.test(email) ||
      !["reader", "editor"].includes(raw.role) ||
      !["approved", "revoked"].includes(raw.status)
    )
      fail("Choose a valid email, role and status.");
    return transaction(async (client) => {
      await read(slug, user, client, true);
      await client.query(
        `INSERT INTO ebook_access(slug,email,role,status,approved_at,approved_by) VALUES($1,$2,$3,$4,NOW(),$5) ON CONFLICT(slug,email) DO UPDATE SET role=$3,status=$4,approved_at=NOW(),approved_by=$5`,
        [slug, email, raw.role, raw.status, emailOf(user)],
      );
    });
  }
  async function progress(slug, user, raw) {
    const { row } = await read(slug, user);
    if (!raw)
      return (
        (
          await db.query(
            "SELECT completed,bookmark FROM ebook_progress WHERE slug=$1 AND user_id=$2",
            [slug, user.id],
          )
        ).rows[0] || { completed: [], bookmark: null }
      );
    const ids = new Set(row.document.chapters.map((c) => c.id));
    if (
      !Array.isArray(raw.completed) ||
      raw.completed.length > 50 ||
      raw.completed.some((id) => !ids.has(id)) ||
      (raw.bookmark != null && !ids.has(raw.bookmark))
    )
      fail("Progress contains an unknown chapter.");
    const completed = [...new Set(raw.completed)];
    await db.query(
      `INSERT INTO ebook_progress(slug,user_id,completed,bookmark) VALUES($1,$2,$3,$4) ON CONFLICT(slug,user_id) DO UPDATE SET completed=EXCLUDED.completed,bookmark=EXCLUDED.bookmark,updated_at=NOW()`,
      [slug, user.id, JSON.stringify(completed), raw.bookmark || null],
    );
    return { completed, bookmark: raw.bookmark || null };
  }
  function attemptView(row) {
    const doc = row.snapshot;
    return {
      id: row.id,
      slug: row.slug,
      title: doc.title,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      submittedAt: row.submitted_at,
      serverNow: new Date(clock()).toISOString(),
      negativeMarks: Number(row.negative_marks),
      passPercent: doc.passPercent ?? 70,
      marksPerCorrect: doc.marksPerCorrect ?? 1,
      answers: row.answers,
      result: row.result,
      questions: doc.finalExamQuestions.map(
        ({ answer, explanation, ...q }) => q,
      ),
    };
  }
  async function start(slug, user, raw) {
    if (
      raw.negativeMarking !== undefined &&
      typeof raw.negativeMarking !== "boolean"
    )
      fail("Negative marking must be true or false.");
    return transaction(async (client) => {
      const { row } = await read(slug, user, client, true);
      // A learner can explicitly challenge the exam without completing chapters.
      const expires = new Date(clock() + row.document.examMinutes * 60000);
      const saved = (
        await client.query(
          `INSERT INTO ebook_attempts(slug,user_id,snapshot,negative_marks,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING *`,
          [
            slug,
            user.id,
            JSON.stringify(row.document),
            raw.negativeMarking === undefined
              ? (row.document.negativeMarks ?? 0)
              : raw.negativeMarking
                ? 0.25
                : 0,
            expires,
          ],
        )
      ).rows[0];
      return attemptView(saved);
    });
  }
  async function attempt(id, user, raw, submit = false) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) fail("Attempt not found", 404);
    return transaction(async (client) => {
      // Lock the book before the attempt: access revocation and submission serialize.
      const ref = (
        await client.query(
          "SELECT slug FROM ebook_attempts WHERE id=$1 AND user_id=$2",
          [id, user.id],
        )
      ).rows[0];
      if (!ref) fail("Attempt not found", 404);
      await read(ref.slug, user, client, true);
      let row = (
        await client.query(
          "SELECT * FROM ebook_attempts WHERE id=$1 AND user_id=$2 FOR UPDATE",
          [id, user.id],
        )
      ).rows[0];
      if (!raw || row.submitted_at) return attemptView(row);
      const onTime = clock() <= new Date(row.expires_at).getTime();
      if (!submit && !onTime)
        fail(
          "Time expired. Submit the saved answers to see your result.",
          409,
          "EBOOK_TIME_EXPIRED",
        );
      const answers = onTime
        ? { ...row.answers, ...cleanAnswers(raw.answers || {}, row.snapshot) }
        : row.answers;
      const result = submit
        ? grade(row.snapshot, answers, row.negative_marks)
        : null;
      row = (
        await client.query(
          `UPDATE ebook_attempts SET answers=$2,submitted_at=CASE WHEN $3::boolean THEN NOW() ELSE NULL END,result=$4 WHERE id=$1 RETURNING *`,
          [
            id,
            JSON.stringify(answers),
            submit,
            result ? JSON.stringify(result) : null,
          ],
        )
      ).rows[0];
      return attemptView(row);
    });
  }
  async function history(user) {
    const rows = (
      await db.query(
        `SELECT a.id,a.slug,a.started_at,a.submitted_at,a.result,b.document->>'title' AS title,b.visibility,x.role AS access_role,x.status AS access_status FROM ebook_attempts a JOIN ebooks b ON b.slug=a.slug LEFT JOIN ebook_access x ON x.slug=b.slug AND x.email=$2 WHERE a.user_id=$1 AND NOT b.archived ORDER BY a.started_at DESC LIMIT 50`,
        [user.id, emailOf(user)],
      )
    ).rows;
    return rows
      .filter(
        (row) =>
          permissions(row, user, {
            role: row.access_role,
            status: row.access_status,
          }).canRead,
      )
      .map(({ access_role, access_status, visibility, result, ...row }) => ({
        ...row,
        result: result
          ? {
              score: result.score,
              total: result.total,
              percentage: result.percentage,
              passed: result.passed,
            }
          : null,
      }));
  }
  async function share(id, user) {
    const view = await attempt(id, user);
    const { row } = await read(view.slug, user);
    if (!view.result?.passed || row.visibility !== "public")
      fail(
        "Only passed results for public ebooks can have public achievement links.",
        403,
      );
    await db.query(
      "UPDATE ebook_attempts SET shared=TRUE WHERE id=$1 AND user_id=$2",
      [id, user.id],
    );
    return { id };
  }
  async function certificate(id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) fail("Achievement not found", 404);
    const row = (
      await db.query(
        `SELECT a.id,a.snapshot->>'title' AS title,a.result->>'percentage' AS percentage,a.submitted_at,u.name FROM ebook_attempts a JOIN ebooks b ON b.slug=a.slug JOIN users u ON u.id=a.user_id WHERE a.id=$1 AND a.shared AND (a.result->>'passed')::boolean AND b.visibility='public' AND NOT b.archived`,
        [id],
      )
    ).rows[0];
    if (!row) fail("Achievement not found", 404);
    return {
      id: row.id,
      title: row.title,
      percentage: Number(row.percentage),
      completedAt: row.submitted_at,
      name: row.name || "ExamPro learner",
      issuer: "ExamPro",
      credential: "Skill Completion Certificate",
    };
  }
  return {
    list,
    get,
    save,
    practice,
    archive,
    uploadPdf,
    pdf,
    requestAccess,
    accessQueue,
    approve,
    progress,
    start,
    attempt,
    history,
    share,
    certificate,
  };
}
module.exports = {
  ...createEbooksService(),
  createEbooksService,
  permissions,
  isOwnerAdmin,
  validateBook,
  grade,
  cleanAnswers,
};
