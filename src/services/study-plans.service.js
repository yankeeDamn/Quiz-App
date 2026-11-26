"use strict";
const database = require("../config/database");
const v = require("./study-plans.validation");
const { isPlanActive } = require("./plan.service");
const { isOwnerAdmin } = require("./ebooks.service");
const logger = require("../utils/logger");
const UPCOMING = [
  [
    "ssc-cgl",
    "SSC CGL",
    "Structured preparation for the Combined Graduate Level examination.",
  ],
  [
    "railway-rrb",
    "Railway RRB",
    "Preparation plans for Railway recruitment examinations.",
  ],
  [
    "upsc-general-studies",
    "UPSC General Studies",
    "Structured General Studies preparation.",
  ],
  [
    "banking-ibps",
    "Banking IBPS",
    "Preparation for banking recruitment examinations.",
  ],
];
function createService(db = database, books = require("./ebooks.service")) {
  const rows = async (sql, args = [], c = db) =>
    (await c.query(sql, args)).rows;
  const one = async (sql, args = [], c = db) => {
    const r = (await rows(sql, args, c))[0];
    if (!r) throw v.fail("Record not found", 404);
    return r;
  };
  const tx = async (fn) => {
    const c = await db.getClient();
    try {
      await c.query("BEGIN");
      const result = await fn(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  };
  function admin(user) {
    if (!isOwnerAdmin(user))
      throw v.fail(
        "Only an authorized administrator can manage study plans",
        403,
      );
    return user.email.toLowerCase();
  }
  function signed(user) {
    if (!user?.id || user.id === "guest")
      throw v.fail("Sign in to save progress", 401);
    return v.id(user.id);
  }
  async function pro(user, c = db) {
    if (!user?.id || user.id === "guest") return false;
    // Canonical balance is authoritative: revokePlan clears it while historical grants remain.
    const u = (
      await rows(
        "SELECT plan,plan_expires_at FROM users WHERE id=$1",
        [user.id],
        c,
      )
    )[0];
    if (!u || !isPlanActive(u.plan, u.plan_expires_at)) return false;
    if (u.plan === "pro") return true;
    return (
      (
        await rows(
          "SELECT 1 FROM monetization_grants WHERE user_id=$1 AND code IN ('PRO_MONTHLY','PRO_ANNUAL') AND expires_at>now() LIMIT 1",
          [user.id],
          c,
        )
      ).length > 0
    );
  }
  async function allowed(plan, user) {
    return plan.access_policy === "free" || (await pro(user));
  }
  async function insert(table, data, c = db) {
    const keys = Object.keys(data);
    return one(
      `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
      Object.values(data),
      c,
    );
  }
  async function update(table, id, data, c = db) {
    const keys = Object.keys(data);
    return one(
      `UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING *`,
      [id, ...Object.values(data)],
      c,
    );
  }
  async function mutable(planId, c) {
    const p = await one(
      "SELECT * FROM study_plans WHERE id=$1 FOR UPDATE",
      [v.id(planId)],
      c,
    );
    if (p.status !== "draft" || p.published_at)
      throw v.fail(
        "Published editions are immutable. Clone a new draft edition.",
        409,
      );
    return p;
  }
  async function syllabusEditable(id, c) {
    if (
      (
        await rows(
          "SELECT 1 FROM study_plans WHERE syllabus_id=$1 AND published_at IS NOT NULL LIMIT 1",
          [id],
          c,
        )
      ).length
    )
      throw v.fail(
        "This syllabus is used by a published edition. Create a new syllabus version.",
        409,
      );
  }
  async function catalogue(user) {
    const plans =
      await rows(`SELECT DISTINCT ON(p.slug) p.id,p.slug,p.edition,p.exam_id,p.title,p.description,p.duration,p.daily_minutes,p.access_policy,s.version AS syllabus_version,e.name,
   (SELECT count(*)::int FROM study_tasks t WHERE t.plan_id=p.id) AS modules,
   EXISTS(SELECT 1 FROM study_tasks t WHERE t.plan_id=p.id AND t.preview) AS preview,
   ARRAY(SELECT name FROM study_topics WHERE syllabus_id=p.syllabus_id AND kind='subject' AND status='published' ORDER BY display_order) AS subjects
   FROM study_plans p JOIN study_exams e ON e.id=p.exam_id JOIN study_syllabuses s ON s.id=p.syllabus_id
   WHERE p.status='published' AND e.status='published' ORDER BY p.slug,p.edition DESC`);
    const hasPro = await pro(user);
    return {
      plans: plans.map((p) => ({
        ...p,
        access: p.access_policy === "free" || hasPro,
      })),
      upcoming: UPCOMING.filter(
        ([id]) => !plans.some((p) => p.exam_id === id),
      ).map(([id, name, description]) => ({
        id,
        name,
        description,
        status: "upcoming",
      })),
    };
  }
  async function resolve(slug, user, previewId) {
    if (previewId) {
      admin(user);
      return one(
        "SELECT p.*,s.version AS syllabus_version,e.name FROM study_plans p JOIN study_syllabuses s ON s.id=p.syllabus_id JOIN study_exams e ON e.id=p.exam_id WHERE p.id=$1",
        [v.id(previewId)],
      );
    }
    v.slug(slug);
    return one(
      `SELECT p.*,s.version AS syllabus_version,e.name FROM study_plans p JOIN study_syllabuses s ON s.id=p.syllabus_id JOIN study_exams e ON e.id=p.exam_id
   WHERE p.slug=$1 AND p.status='published' AND e.status='published'
   ORDER BY EXISTS(SELECT 1 FROM study_enrollments en WHERE en.plan_id=p.id AND en.user_id=$2) DESC,p.edition DESC LIMIT 1`,
      [slug, user?.id || null],
    );
  }
  async function overview(slug, user, previewId) {
    const p = await resolve(slug, user, previewId),
      access = !!previewId || (await allowed(p, user));
    const days = await rows(
      `SELECT d.day,CASE WHEN $2 THEN d.objectives ELSE '' END AS objectives,count(t.id)::int AS tasks,count(t.id) FILTER(WHERE t.preview)::int AS previews FROM study_days d LEFT JOIN study_tasks t ON t.plan_id=d.plan_id AND t.day=d.day WHERE d.plan_id=$1 GROUP BY d.plan_id,d.day ORDER BY d.day`,
      [p.id, access],
    );
    const subjects = await rows(
      "SELECT name FROM study_topics WHERE syllabus_id=$1 AND kind='subject' AND (status='published' OR ($2 AND status='draft')) ORDER BY display_order",
      [p.syllabus_id, !!previewId],
    );
    const summary = {
      id: p.id,
      slug: p.slug,
      edition: p.edition,
      title: p.title,
      description: p.description,
      name: p.name,
      syllabus_version: p.syllabus_version,
      duration: p.duration,
      daily_minutes: p.daily_minutes,
      level: p.level,
      access_policy: p.access_policy,
      access,
      days,
      subjects,
      preview: !!previewId,
    };
    if (access) {
      summary.milestones = await rows(
        "SELECT day,title,kind FROM study_tasks WHERE plan_id=$1 AND kind IN ('revision','mock') ORDER BY day,display_order",
        [p.id],
      );
      summary.weekly_goals = p.weekly_goals;
      summary.completion_criteria = p.completion_criteria;
    }
    if (user?.id && !previewId)
      summary.progress = await progress(p, user, access);
    return summary;
  }
  async function progress(p, user, includeResults = true) {
    const uid = signed(user);
    const enrollment =
      (
        await rows(
          "SELECT start_date,current_day,enrolled_at FROM study_enrollments WHERE user_id=$1 AND plan_id=$2",
          [uid, p.id],
        )
      )[0] || null;
    if (!enrollment) return null;
    const ts = await rows(
      "SELECT id,day,topic_id,required FROM study_tasks WHERE plan_id=$1 ORDER BY day,display_order,id",
      [p.id],
    );
    const cs = await rows(
      "SELECT task_id,completed_at FROM study_completions WHERE user_id=$1 AND plan_id=$2",
      [uid, p.id],
    );
    const results = includeResults
      ? await rows(
          `SELECT id,test_id,submitted_at,result FROM exam_attempts_v2 WHERE user_id=$1 AND submitted_at IS NOT NULL AND test_id IN (SELECT mock_id FROM study_tasks WHERE plan_id=$2) ORDER BY submitted_at DESC LIMIT 50`,
          [uid, p.id],
        )
      : [];
    return { ...v.progress(ts, cs), enrollment, results };
  }
  async function day(slug, number, user, previewId) {
    const p = await resolve(slug, user, previewId);
    v.integer(number, "Day", 1, p.duration);
    const access = !!previewId || (await allowed(p, user)),
      paid = !!previewId || (await pro(user));
    const tasks = await rows(
      "SELECT * FROM study_tasks WHERE plan_id=$1 AND day=$2 AND ($3 OR preview) ORDER BY display_order,id",
      [p.id, number, access],
    );
    const d = await one(
      "SELECT * FROM study_days WHERE plan_id=$1 AND day=$2",
      [p.id, number],
    );
    for (const t of tasks) {
      t.questions = await rows(
        `SELECT q.id,q.question,q.options,q.difficulty FROM study_task_questions l JOIN mock_questions q ON q.id=l.question_id WHERE l.task_id=$1 AND q.active AND q.review_status='published' AND ($2 OR q.access_tier='free') AND ($3 <> 'pyq' OR EXISTS(SELECT 1 FROM study_pyq_metadata py WHERE py.question_id=q.id AND py.verification='verified' AND py.exam_id=$4)) ORDER BY l.display_order`,
        [t.id, paid, t.kind, p.exam_id],
      );
      t.resource = t.resource_id
        ? (
            await rows(
              `SELECT id,title,description,kind,access_policy FROM study_resources WHERE id=$1 AND ($2 OR status='published') AND ($3 OR access_policy='free')`,
              [t.resource_id, !!previewId, access],
            )
          )[0] || null
        : null;
      delete t.resource_id;
    }
    return {
      planId: p.id,
      title: p.title,
      day: number,
      duration: p.duration,
      objectives: access ? d.objectives : "Free preview",
      access,
      tasks,
      preview: !!previewId,
    };
  }
  async function enroll(slug, user, input) {
    const uid = signed(user),
      p = await resolve(slug, user);
    if (!(await allowed(p, user)))
      throw v.fail("An active Pro subscription is required to enroll", 403);
    const date = input?.start_date;
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw v.fail("Choose a valid start date (YYYY-MM-DD)");
    await db.query(
      "INSERT INTO study_enrollments(user_id,plan_id,start_date) VALUES($1,$2,$3) ON CONFLICT(user_id,plan_id) DO NOTHING",
      [uid, p.id, date],
    );
    return progress(p, user);
  }
  async function complete(slug, taskId, user, input) {
    const uid = signed(user);
    v.id(taskId);
    v.boolean(input?.completed, "Completed");
    const p = await resolve(slug, user);
    if (!(await allowed(p, user)))
      throw v.fail("Active Pro access required", 403);
    await tx(async (c) => {
      await one(
        "SELECT * FROM study_enrollments WHERE user_id=$1 AND plan_id=$2 FOR UPDATE",
        [uid, p.id],
        c,
      );
      const t = await one(
        "SELECT day FROM study_tasks WHERE id=$1 AND plan_id=$2",
        [taskId, p.id],
        c,
      );
      if (input.completed)
        await c.query(
          "INSERT INTO study_completions(user_id,plan_id,task_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [uid, p.id, taskId],
        );
      else
        await c.query(
          "DELETE FROM study_completions WHERE user_id=$1 AND plan_id=$2 AND task_id=$3",
          [uid, p.id, taskId],
        );
      await c.query(
        "UPDATE study_enrollments SET current_day=$3 WHERE user_id=$1 AND plan_id=$2",
        [uid, p.id, t.day],
      );
    });
    return progress(p, user);
  }
  async function resource(slug, taskId, user, download = false) {
    const p = await resolve(slug, user),
      access = await allowed(p, user);
    const t = await one(
      "SELECT * FROM study_tasks WHERE id=$1 AND plan_id=$2",
      [v.id(taskId), p.id],
    );
    if (!access && !t.preview) throw v.fail("Active Pro access required", 403);
    const r = await one(
      "SELECT * FROM study_resources WHERE id=$1 AND status='published'",
      [t.resource_id],
    );
    if (r.access_policy === "pro" && !(await pro(user)))
      throw v.fail("Active Pro access required for this resource", 403);
    if (!r.ebook_slug) return { url: r.source_url };
    await validateResource(r, db, true);
    return books.pdf(r.ebook_slug, user, download);
  }
  async function answer(slug, taskId, qid, user, input) {
    const p = await resolve(slug, user),
      access = await allowed(p, user),
      paid = await pro(user);
    const t = await one(
      "SELECT * FROM study_tasks WHERE id=$1 AND plan_id=$2",
      [v.id(taskId), p.id],
    );
    if (!access && !t.preview) throw v.fail("Active Pro access required", 403);
    const q = await one(
      `SELECT q.answer,q.explanation FROM mock_questions q JOIN study_task_questions l ON l.question_id=q.id WHERE l.task_id=$1 AND q.id=$2 AND q.active AND q.review_status='published' AND ($3 OR q.access_tier='free') AND ($4 <> 'pyq' OR EXISTS(SELECT 1 FROM study_pyq_metadata py WHERE py.question_id=q.id AND py.verification='verified' AND py.exam_id=$5))`,
      [t.id, v.id(qid), paid, t.kind, p.exam_id],
    );
    v.integer(input?.answer, "Answer", 0, 3);
    return { ...q, correct: q.answer === input.answer };
  }
  async function validateResource(r, c, publishing = false) {
    if (r.topic_id)
      await one(
        "SELECT t.id FROM study_topics t JOIN study_syllabuses s ON s.id=t.syllabus_id WHERE t.id=$1 AND s.exam_id=$2",
        [r.topic_id, r.exam_id],
        c,
      );
    if (!r.ebook_slug) {
      if (r.access_policy !== "free" || !r.source_url)
        throw v.fail("Paid resources must use a private Ebook Studio PDF");
      return;
    }
    const b = await one(
      "SELECT * FROM ebooks WHERE slug=$1 AND NOT archived",
      [r.ebook_slug],
      c,
    );
    if (
      r.access_policy === "pro" &&
      (b.access_level !== "pro" || b.document.studyProOnly !== true)
    )
      throw v.fail(
        "Premium attachment needs an ebook created with Study Pro-only scope; existing ebook pass purchases are preserved",
      );
    if (publishing) {
      if (b.visibility !== "public")
        throw v.fail(
          "Publish the ebook visibility before publishing its study attachment",
        );
      await one(
        "SELECT slug FROM ebook_pdf_assets WHERE slug=$1",
        [r.ebook_slug],
        c,
      );
    }
  }
  async function adminList(user) {
    admin(user);
    return {
      exams: await rows("SELECT * FROM study_exams ORDER BY display_order,id"),
      syllabuses: await rows(
        "SELECT * FROM study_syllabuses ORDER BY exam_id,version",
      ),
      topics: await rows(
        "SELECT t.*,ARRAY(SELECT prerequisite_id FROM study_prerequisites WHERE topic_id=t.id) AS prerequisites FROM study_topics t ORDER BY display_order,name",
      ),
      plans: await rows("SELECT * FROM study_plans ORDER BY slug,edition DESC"),
      resources: await rows(
        `SELECT r.*,a.filename,octet_length(a.bytes) AS file_size,'application/pdf' AS file_type FROM study_resources r LEFT JOIN ebook_pdf_assets a ON a.slug=r.ebook_slug ORDER BY r.uploaded_at DESC`,
      ),
      ebooks: await rows(
        "SELECT slug,document->>'title' AS title,access_level,visibility FROM ebooks WHERE NOT archived ORDER BY slug",
      ),
      mocks: await rows("SELECT id,name,active FROM mock_tests ORDER BY name"),
      bankTopics: await rows("SELECT id,name FROM mock_topics ORDER BY name"),
    };
  }
  async function saveExam(user, raw, examId) {
    admin(user);
    const data = v.exam(raw);
    if (examId && data.id !== examId)
      throw v.fail("Exam identifier cannot change");
    return examId
      ? update("study_exams", examId, data)
      : insert("study_exams", data);
  }
  async function saveSyllabus(user, raw, sid) {
    const actor = admin(user),
      d = v.syllabus(raw);
    delete d.verified;
    const value = {
      ...d,
      verified_by: raw.verified ? actor : null,
      verified_at: raw.verified ? new Date() : null,
    };
    return tx(async (c) => {
      if (sid) {
        await one(
          "SELECT id FROM study_syllabuses WHERE id=$1 FOR UPDATE",
          [v.id(sid)],
          c,
        );
        await syllabusEditable(sid, c);
        return update("study_syllabuses", sid, value, c);
      }
      return insert("study_syllabuses", value, c);
    });
  }
  async function saveTopic(user, raw, topicId) {
    admin(user);
    const d = v.topic(raw);
    return tx(async (c) => {
      await one(
        "SELECT id FROM study_syllabuses WHERE id=$1 FOR UPDATE",
        [d.syllabus_id],
        c,
      );
      await syllabusEditable(d.syllabus_id, c);
      if (topicId) {
        const old = await one(
          "SELECT * FROM study_topics WHERE id=$1",
          [v.id(topicId)],
          c,
        );
        if (
          old.syllabus_id !== d.syllabus_id ||
          old.kind !== d.kind ||
          old.parent_id !== d.parent_id
        )
          throw v.fail(
            "Parent, level and syllabus are stable; create a new topic instead",
          );
      }
      const parents = {
        stage: null,
        subject: "stage",
        chapter: "subject",
        topic: "chapter",
      };
      if (d.kind === "stage" && d.parent_id)
        throw v.fail("Stage cannot have a parent");
      if (d.kind !== "stage") {
        const parent = await one(
          "SELECT * FROM study_topics WHERE id=$1 AND syllabus_id=$2",
          [d.parent_id, d.syllabus_id],
          c,
        );
        if (parent.kind !== parents[d.kind])
          throw v.fail("Use Stage → Subject → Chapter → Topic hierarchy");
      }
      const saved = topicId
        ? await update("study_topics", topicId, d, c)
        : await insert("study_topics", d, c);
      const prereqs = raw.prerequisites ?? [];
      if (!Array.isArray(prereqs) || prereqs.length > 30)
        throw v.fail("Maximum 30 prerequisites");
      await c.query("DELETE FROM study_prerequisites WHERE topic_id=$1", [
        saved.id,
      ]);
      for (const pid of new Set(prereqs)) {
        v.id(pid);
        if (pid === saved.id) throw v.fail("A topic cannot require itself");
        await one(
          "SELECT id FROM study_topics WHERE id=$1 AND syllabus_id=$2 AND kind='topic'",
          [pid, d.syllabus_id],
          c,
        );
        const cycle = await rows(
          "WITH RECURSIVE deps(id) AS (SELECT prerequisite_id FROM study_prerequisites WHERE topic_id=$1 UNION SELECT sp.prerequisite_id FROM study_prerequisites sp JOIN deps d ON sp.topic_id=d.id) SELECT 1 FROM deps WHERE id=$2",
          [pid, saved.id],
          c,
        );
        if (cycle.length) throw v.fail("Prerequisites would create a cycle");
        await c.query("INSERT INTO study_prerequisites VALUES($1,$2)", [
          saved.id,
          pid,
        ]);
      }
      return saved;
    });
  }
  async function saveResource(user, raw, rid) {
    const actor = admin(user),
      d = v.resource(raw);
    return tx(async (c) => {
      await validateResource(d, c, d.status === "published");
      if (rid) {
        await one(
          "SELECT id FROM study_resources WHERE id=$1 FOR UPDATE",
          [v.id(rid)],
          c,
        );
        return update("study_resources", rid, d, c);
      }
      return insert("study_resources", { ...d, uploaded_by: actor }, c);
    });
  }
  async function savePlan(user, raw, pid) {
    const actor = admin(user),
      d = v.plan(raw);
    return tx(async (c) => {
      if (pid) {
        const p = await mutable(pid, c);
        v.integer(raw.revision, "Revision", 1);
        if (p.revision !== raw.revision)
          throw v.fail("Plan changed. Reload before saving.", 409);
        if (
          p.slug !== d.slug ||
          p.exam_id !== d.exam_id ||
          p.syllabus_id !== d.syllabus_id
        )
          throw v.fail("Plan identifier, exam and syllabus cannot change");
        if (
          (
            await rows(
              "SELECT 1 FROM study_days WHERE plan_id=$1 AND day>$2",
              [pid, d.duration],
              c,
            )
          ).length
        )
          throw v.fail("Duration cannot exclude existing days");
        return update(
          "study_plans",
          pid,
          { ...d, revision: p.revision + 1 },
          c,
        );
      }
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [d.slug]);
      if (
        (await rows("SELECT 1 FROM study_plans WHERE slug=$1", [d.slug], c))
          .length
      )
        throw v.fail("Identifier exists. Clone an edition instead.", 409);
      return insert("study_plans", { ...d, edition: 1, created_by: actor }, c);
    });
  }
  async function saveTask(user, pid, raw, tid) {
    admin(user);
    const d = v.task(raw);
    return tx(async (c) => {
      const p = await mutable(pid, c);
      if (d.day > p.duration) throw v.fail("Day exceeds plan duration");
      if (d.topic_id)
        await one(
          "SELECT id FROM study_topics WHERE id=$1 AND syllabus_id=$2",
          [d.topic_id, p.syllabus_id],
          c,
        );
      if (d.resource_id)
        await one(
          "SELECT id FROM study_resources WHERE id=$1 AND exam_id=$2",
          [d.resource_id, p.exam_id],
          c,
        );
      if (tid)
        await one(
          "SELECT id FROM study_tasks WHERE id=$1 AND plan_id=$2",
          [v.id(tid), pid],
          c,
        );
      await c.query(
        "INSERT INTO study_days(plan_id,day,objectives) VALUES($1,$2,$3) ON CONFLICT(plan_id,day) DO UPDATE SET objectives=EXCLUDED.objectives",
        [pid, d.day, v.text(raw.objectives || "", "Day objectives")],
      );
      const task = tid
        ? await update("study_tasks", tid, d, c)
        : await insert("study_tasks", { ...d, plan_id: pid }, c);
      const qids = raw.question_ids ?? [];
      if (!Array.isArray(qids) || qids.length > 200)
        throw v.fail("Maximum 200 linked questions");
      await c.query("DELETE FROM study_task_questions WHERE task_id=$1", [
        task.id,
      ]);
      for (const [i, qid] of [...new Set(qids)].entries())
        await c.query(
          "INSERT INTO study_task_questions(task_id,question_id,display_order) VALUES($1,$2,$3)",
          [task.id, v.id(qid), i],
        );
      await c.query("UPDATE study_plans SET revision=revision+1 WHERE id=$1", [
        pid,
      ]);
      return task;
    });
  }
  async function detail(user, pid) {
    admin(user);
    const p = await one("SELECT * FROM study_plans WHERE id=$1", [v.id(pid)]);
    return {
      ...p,
      days: await rows(
        "SELECT * FROM study_days WHERE plan_id=$1 ORDER BY day",
        [pid],
      ),
      tasks: await rows(
        "SELECT t.*,ARRAY(SELECT question_id FROM study_task_questions WHERE task_id=t.id ORDER BY display_order) AS question_ids FROM study_tasks t WHERE plan_id=$1 ORDER BY day,display_order,id",
        [pid],
      ),
    };
  }
  // The checklist and the actual publish action use the same validation.
  // Batch-load dependencies rather than issuing hundreds of per-task queries.
  async function checkReadiness(p, c = db) {
    const issues = [];
    const add = (code, message, task) => issues.push({
      code, message, ...(task ? { day: task.day, taskId: task.id, taskTitle: task.title } : {}),
    });
    const exam = (await rows("SELECT * FROM study_exams WHERE id=$1", [p.exam_id], c))[0];
    const sy = (await rows("SELECT * FROM study_syllabuses WHERE id=$1 AND exam_id=$2", [p.syllabus_id, p.exam_id], c))[0];
    const topics = await rows("SELECT * FROM study_topics WHERE syllabus_id=$1", [p.syllabus_id], c);
    const byTopic = new Map(topics.map(t => [t.id, t]));
    const tasks = await rows("SELECT * FROM study_tasks WHERE plan_id=$1 ORDER BY day,display_order,id", [p.id], c);
    if (p.status !== "draft" || p.published_at) add("edition", "Only a never-published draft can be published.");
    if (!exam || exam.status !== "published") add("exam", "Review and publish the exam record in Exams first.");
    if (!sy?.verified_by || !sy?.verified_at) add("syllabus", "Verify the official syllabus source and version in Syllabuses.");
    if (!tasks.some(t => t.required)) add("days", "Add at least one required task.");
    const covered = new Set(tasks.map(t => t.day));
    const missing = Array.from({length: p.duration}, (_, i) => i + 1).filter(d => !covered.has(d));
    if (missing.length) add("days", "Add tasks to missing days: " + missing.join(", "));
    const badTopics = new Set();
    for (const t of tasks) {
      const seen = new Set();
      let id = t.topic_id;
      while (id) {
        const node = byTopic.get(id);
        if (!node || seen.has(id)) {
          add("topics", "Invalid syllabus hierarchy; review the task topic.", t);
          break;
        }
        seen.add(id);
        if (node.status !== "published") badTopics.add(node.id);
        id = node.parent_id;
      }
    }
    if (badTopics.size) add("topics", badTopics.size + " referenced syllabus nodes (including parents) are not published. Review Topics first.");
    const resources = await rows("SELECT * FROM study_resources WHERE id IN (SELECT resource_id FROM study_tasks WHERE plan_id=$1)", [p.id], c);
    const resourceMap = new Map(resources.map(r => [r.id, r]));
    const resourceErrors = new Map();
    for (const r of resources) {
      if (r.status !== "published" || r.exam_id !== p.exam_id) {
        resourceErrors.set(r.id, "Review the linked resource in Resources.");
        continue;
      }
      try { await validateResource(r, c, true); }
      catch (err) {
        if (![400, 404, 409].includes(err.statusCode)) throw err;
        resourceErrors.set(r.id, err.message === "Record not found" ? "The resource's ebook, PDF asset or topic is missing." : err.message);
      }
    }
    const mocks = await rows("SELECT id,name,tier,active FROM mock_tests WHERE id IN (SELECT mock_id FROM study_tasks WHERE plan_id=$1)", [p.id], c);
    const mockMap = new Map(mocks.map(m => [m.id, m]));
    const validMocks = new Map();
    for (const m of mocks) validMocks.set(m.id, m.active && !!(await require("./mocks.service").findMock(m.id)));
    const questions = await rows("SELECT l.task_id,q.id,q.active,q.review_status,q.access_tier,py.verification,py.exam_id AS pyq_exam_id FROM study_task_questions l JOIN study_tasks t ON t.id=l.task_id JOIN mock_questions q ON q.id=l.question_id LEFT JOIN study_pyq_metadata py ON py.question_id=q.id WHERE t.plan_id=$1", [p.id], c);
    const byTask = new Map();
    for (const q of questions) {
      if (!byTask.has(q.task_id)) byTask.set(q.task_id, []);
      byTask.get(q.task_id).push(q);
    }
    for (const t of tasks) {
      const free = t.preview || p.access_policy === "free";
      if (t.resource_id) {
        const r = resourceMap.get(t.resource_id);
        if (!r || resourceErrors.has(t.resource_id)) add("resources", resourceErrors.get(t.resource_id) || "Linked resource is missing.", t);
        if (r && free && r.access_policy === "pro") add("resources", "Free tasks cannot attach premium resources.", t);
      } else if (t.kind === "pdf") add("resources", "PDF task requires a resource.", t);
      if (t.mock_id) {
        const m = mockMap.get(t.mock_id);
        if (!validMocks.get(t.mock_id)) add("mocks", "Linked mock " + (m?.name || t.mock_id) + " is not available in the published catalogue. Review it in the existing mock editor or replace the link.", t);
        if (m && free && m.tier !== "free") add("mocks", "Free tasks cannot link premium mocks.", t);
      } else if (["mock","quiz"].includes(t.kind)) add("mocks", "Quiz/mock task requires an existing mock.", t);
      const qs = byTask.get(t.id) || [];
      if (t.kind === "pyq" && !qs.length) add("questions", "PYQ task requires linked questions.", t);
      if (qs.some(q => !q.active || q.review_status !== "published")) add("questions", "Linked questions must be published and active.", t);
      if (free && qs.some(q => q.access_tier !== "free")) add("questions", "Preview questions must be Free.", t);
      if (t.kind === "pyq" && qs.some(q => q.verification !== "verified" || q.pyq_exam_id !== p.exam_id)) add("questions", "PYQ provenance must be verified before publication.", t);
    }
    const labels = {edition:"Draft edition",exam:"Exam review",syllabus:"Official syllabus",topics:"Topic hierarchy",days:"Daily tasks",resources:"Resources and PDF permissions",mocks:"Mock availability",questions:"Question and PYQ permissions"};
    return {
      ready: issues.length === 0, revision: p.revision,
      checks: Object.entries(labels).map(([code,label]) => ({code,label,passed: !issues.some(i => i.code === code),issues: issues.filter(i => i.code === code)})),
      review: {examStatus: exam?.status || "missing", syllabusVerified: !!(sy?.verified_by && sy?.verified_at), draftTopics: topics.filter(t => t.status === "draft").length, archivedTopics: topics.filter(t => t.status === "archived").length},
    };
  }
  async function readiness(user, pid) {
    admin(user);
    const p = await one("SELECT * FROM study_plans WHERE id=$1", [v.id(pid)]);
    return checkReadiness(p);
  }
  // Explicit admin review of prerequisites, scoped to the selected draft.
  // Never publishes a plan, changes questions/mocks, or touches archived nodes.
  async function reviewPrerequisites(user, pid, input) {
    const actor = admin(user);
    if (input?.acknowledged !== true) throw v.fail("Confirm you have reviewed the selected prerequisites.");
    const fields = ["exam", "syllabus", "topics"];
    if (fields.some(k => typeof input[k] !== "boolean") || !fields.some(k => input[k])) throw v.fail("Select at least one prerequisite to review.");
    return tx(async c => {
      const p = await mutable(pid, c);
      if (p.revision !== input.revision) throw v.fail("Plan changed. Reload and review again.", 409);
      const sy = await one("SELECT * FROM study_syllabuses WHERE id=$1 AND exam_id=$2 FOR UPDATE", [p.syllabus_id,p.exam_id], c);
      const exam = await one("SELECT * FROM study_exams WHERE id=$1 FOR UPDATE", [p.exam_id], c);
      if (input.exam && exam.status === "archived") throw v.fail("Archived exams require individual review.");
      if (input.exam && !exam.source_url) throw v.fail("Add the official exam source before review.");
      if (input.syllabus || input.topics) await syllabusEditable(sy.id, c);
      if (input.syllabus && !sy.source_url) throw v.fail("Add the official syllabus source before verification.");
      if (input.topics) {
        if (!input.syllabus && !sy.verified_at) throw v.fail("Verify the syllabus before reviewing topics.");
        const all = await rows("SELECT id,parent_id,kind,status FROM study_topics WHERE syllabus_id=$1 FOR UPDATE", [sy.id], c);
        const byId = new Map(all.map(t => [t.id,t]));
        const kinds = {stage:null,subject:"stage",chapter:"subject",topic:"chapter"};
        for (const t of all.filter(t => t.status === "draft")) {
          const parent = byId.get(t.parent_id);
          if ((t.kind === "stage" && t.parent_id) || (t.kind !== "stage" && (!parent || parent.kind !== kinds[t.kind] || parent.status === "archived"))) throw v.fail("Resolve invalid or archived topic parents before bulk review.");
        }
        await c.query("UPDATE study_topics SET status='published' WHERE syllabus_id=$1 AND status='draft'", [sy.id]);
      }
      if (input.exam && exam.status === "draft") await c.query("UPDATE study_exams SET status='published',updated_at=now() WHERE id=$1 AND status='draft'", [exam.id]);
      if (input.syllabus) await c.query("UPDATE study_syllabuses SET verified_by=$2,verified_at=now() WHERE id=$1", [sy.id,actor]);
      const result = await update("study_plans", pid, {revision:p.revision+1}, c);
      logger.info({actor,planId:pid,exam:input.exam,syllabus:input.syllabus,topics:input.topics}, "Study prerequisite review; plan remains draft");
      return result;
    });
  }
  async function publish(user, pid, input) {
    const actor = admin(user);
    if (input?.acknowledged !== true) throw v.fail("Confirm syllabus, content, rights and preview review before publishing");
    return tx(async c => {
      const p = await mutable(pid,c);
      if (p.revision !== input.revision) throw v.fail("Plan changed. Reload and preview before publishing.",409);
      await c.query("SELECT id FROM study_syllabuses WHERE id=$1 FOR UPDATE", [p.syllabus_id]);
      const report = await checkReadiness(p,c);
      if (!report.ready) {
        const first = report.checks.find(check => !check.passed).issues[0];
        throw v.fail("Not ready to publish: " + (first.day ? "Day " + first.day + " (" + first.taskTitle + "): " : "") + first.message + " See Publication readiness for all blockers.");
      }
      const result = await update("study_plans",pid,{status:"published",published_at:new Date()},c);
      logger.info({actor,planId:pid},"Study plan published");
      return result;
    });
  }
  async function archive(user, pid) {
    const actor = admin(user);
    const result = await update("study_plans", v.id(pid), {
      status: "archived",
    });
    logger.info({ actor, planId: pid }, "Study plan archived");
    return result;
  }
  async function clone(user, pid) {
    const actor = admin(user);
    return tx(async (c) => {
      const p = await one(
        "SELECT * FROM study_plans WHERE id=$1 FOR UPDATE",
        [v.id(pid)],
        c,
      );
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [p.slug]);
      const { edition } = await one(
        "SELECT max(edition)+1 AS edition FROM study_plans WHERE slug=$1",
        [p.slug],
        c,
      );
      const n = await insert(
        "study_plans",
        { ...v.plan(p), edition, created_by: actor },
        c,
      );
      await c.query(
        "INSERT INTO study_days(plan_id,day,objectives) SELECT $1,day,objectives FROM study_days WHERE plan_id=$2",
        [n.id, pid],
      );
      for (const t of await rows(
        "SELECT * FROM study_tasks WHERE plan_id=$1",
        [pid],
        c,
      )) {
        const nt = await insert(
          "study_tasks",
          { ...v.task(t), plan_id: n.id },
          c,
        );
        await c.query(
          "INSERT INTO study_task_questions(task_id,question_id,display_order) SELECT $1,question_id,display_order FROM study_task_questions WHERE task_id=$2",
          [nt.id, t.id],
        );
      }
      return n;
    });
  }
  async function questionSearch(user, topicId) {
    admin(user);
    return rows(
      `SELECT q.id,q.question,q.options,q.answer,q.explanation,q.difficulty,q.review_status,q.access_tier,py.exam_year,py.verification,py.exam_id,py.topic_id AS syllabus_topic_id,py.stage,py.session,py.language,py.source,py.rights_notes FROM mock_questions q LEFT JOIN study_pyq_metadata py ON py.question_id=q.id WHERE q.topic_id=$1 ORDER BY q.position LIMIT 500`,
      [v.slug(topicId)],
    );
  }
  async function pyqLink(user, qid, input) {
    const actor = admin(user),
      d = v.metadata(input);
    if (
      d.verification === "verified" &&
      (!d.source || !d.stage || !d.exam_year || !d.rights_notes)
    )
      throw v.fail("Verified PYQ needs year, stage, source and rights notes");
    return tx(async (c) => {
      if (d.topic_id)
        await one(
          "SELECT t.id FROM study_topics t JOIN study_syllabuses s ON s.id=t.syllabus_id WHERE t.id=$1 AND s.exam_id=$2",
          [d.topic_id, d.exam_id],
          c,
        );
      await c.query("DELETE FROM study_pyq_metadata WHERE question_id=$1", [
        v.id(qid),
      ]);
      return insert(
        "study_pyq_metadata",
        { ...d, question_id: qid, updated_by: actor },
        c,
      );
    });
  }
  return {
    admin,
    pro,
    catalogue,
    overview,
    day,
    enroll,
    complete,
    resource,
    answer,
    adminList,
    saveExam,
    saveSyllabus,
    saveTopic,
    saveResource,
    savePlan,
    saveTask,
    detail,
    readiness,
    reviewPrerequisites,
    publish,
    archive,
    clone,
    questionSearch,
    pyqLink,
  };
}
module.exports = { ...createService(), createService };
