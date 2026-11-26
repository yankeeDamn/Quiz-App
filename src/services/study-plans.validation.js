"use strict";
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode, code: "STUDY_PLAN_ERROR" });
const text = (v, label, max = 4000, required = false) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw fail(
      `${label}: ${required ? "required; " : ""}maximum ${max} characters`,
    );
  return v.trim();
};
const id = (v) => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    throw fail("Invalid record ID");
  return v;
};
const slug = (v) => {
  if (typeof v !== "string" || !/^[a-z0-9][a-z0-9-]{1,59}$/.test(v))
    throw fail("Use 2–60 lowercase letters, digits or hyphens for identifier");
  return v;
};
const integer = (v, label, min = 0, max = 10000) => {
  if (!Number.isInteger(v) || v < min || v > max)
    throw fail(`${label}: integer ${min}–${max} required`);
  return v;
};
const choice = (v, values, label) => {
  if (!values.includes(v)) throw fail(`${label}: choose ${values.join(", ")}`);
  return v;
};
const boolean = (v, label) => {
  if (typeof v !== "boolean") throw fail(`${label}: boolean required`);
  return v;
};
const url = (v) => (v ? require("./monetization.service").url(v) : "");
const status = (v) => choice(v, ["draft", "published", "archived"], "Status");
const access = (v) => choice(v, ["free", "pro"], "Access");
function fields(raw, spec) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw fail("Object required");
  const out = {};
  for (const [key, fn] of Object.entries(spec)) out[key] = fn(raw[key]);
  return out;
}
function exam(r) {
  return fields(r, {
    id: slug,
    name: (v) => text(v, "Name", 160, true),
    description: (v) => text(v || "", "Description"),
    category: (v) => text(v || "", "Category", 100),
    source_url: (v) => url(v || ""),
    pattern_reference: (v) => text(v || "", "Pattern reference"),
    syllabus_version: (v) => text(v || "", "Syllabus version", 120),
    status: (v) => status(v || "draft"),
    access_policy: (v) => access(v || "pro"),
    display_order: (v) => integer(v ?? 0, "Display order"),
  });
}
function syllabus(r) {
  return fields(r, {
    exam_id: slug,
    version: (v) => text(v, "Version", 120, true),
    source_url: (v) => url(text(v, "Official source URL", 2048, true)),
    pattern_reference: (v) => text(v || "", "Pattern reference"),
    verified: (v) => boolean(v ?? false, "Verified"),
  });
}
function topic(r) {
  return fields(r, {
    syllabus_id: id,
    parent_id: (v) => (v ? id(v) : null),
    kind: (v) =>
      choice(v, ["stage", "subject", "chapter", "topic"], "Hierarchy level"),
    name: (v) => text(v, "Name", 160, true),
    description: (v) => text(v || "", "Description"),
    reference: (v) => text(v || "", "Syllabus reference", 1000),
    objectives: (v) => text(v || "", "Learning objectives"),
    minutes: (v) => integer(v ?? 30, "Minutes", 1, 1440),
    difficulty: (v) =>
      choice(v || "Moderate", ["Easy", "Moderate", "Hard"], "Difficulty"),
    display_order: (v) => integer(v ?? 0, "Order"),
    status: (v) => status(v || "draft"),
  });
}
function plan(r) {
  return fields(r, {
    slug,
    exam_id: slug,
    syllabus_id: id,
    title: (v) => text(v, "Title", 180, true),
    description: (v) => text(v || "", "Description"),
    level: (v) => text(v || "Foundation", "Level", 120, true),
    duration: (v) => integer(v, "Duration", 1, 365),
    daily_minutes: (v) => integer(v, "Daily minutes", 1, 1440),
    weekly_goals: (v) => text(v || "", "Weekly goals"),
    completion_criteria: (v) =>
      text(v || "Complete all required tasks", "Completion criteria"),
    access_policy: (v) => access(v || "pro"),
  });
}
function task(r) {
  return fields(r, {
    day: (v) => integer(v, "Day", 1, 365),
    topic_id: (v) => (v ? id(v) : null),
    title: (v) => text(v, "Title", 180, true),
    description: (v) => text(v || "", "Description", 12000),
    kind: (v) =>
      choice(
        v,
        ["reading", "pdf", "pyq", "quiz", "mock", "revision", "guidance"],
        "Task type",
      ),
    minutes: (v) => integer(v, "Minutes", 1, 1440),
    display_order: (v) => integer(v ?? 0, "Order"),
    required: (v) => boolean(v ?? true, "Required"),
    preview: (v) => boolean(v ?? false, "Preview"),
    resource_id: (v) => (v ? id(v) : null),
    mock_id: (v) => (v ? slug(v) : null),
  });
}
function resource(r) {
  return fields(r, {
    exam_id: slug,
    topic_id: (v) => (v ? id(v) : null),
    title: (v) => text(v, "Title", 180, true),
    description: (v) => text(v || "", "Description"),
    kind: (v) =>
      choice(
        v,
        [
          "syllabus",
          "notes",
          "revision",
          "formula",
          "reference",
          "pyq",
          "other",
        ],
        "Resource type",
      ),
    ebook_slug: (v) => (v ? slug(v) : null),
    source_url: (v) => url(v || ""),
    attribution: (v) => text(v, "Attribution", 1000, true),
    rights_notes: (v) => text(v, "Distribution permission", 2000, true),
    access_policy: (v) => access(v || "pro"),
    status: (v) => status(v || "draft"),
  });
}
function metadata(r) {
  return fields(r, {
    exam_id: slug,
    topic_id: (v) => (v ? id(v) : null),
    exam_year: (v) =>
      v == null || v === "" ? null : integer(v, "Exam year", 1950, 2200),
    stage: (v) => text(v || "", "Stage", 160),
    session: (v) => text(v || "", "Shift/session", 160),
    language: (v) => text(v || "en", "Language", 30, true),
    source: (v) => text(v || "", "Source", 2000),
    verification: (v) =>
      choice(v || "unverified", ["unverified", "verified"], "Verification"),
    rights_notes: (v) => text(v || "", "Rights notes", 2000),
  });
}
function progress(tasks, completions) {
  const done = new Map(completions.map((c) => [c.task_id, c.completed_at]));
  const required = tasks.filter((t) => t.required),
    completed = required.filter((t) => done.has(t.id));
  const days = [...new Set(tasks.map((t) => t.day))].filter((day) => {
    const ts = required.filter((t) => t.day === day);
    return ts.length > 0 && ts.every((t) => done.has(t.id));
  });
  const topics = [
    ...new Set(required.map((t) => t.topic_id).filter(Boolean)),
  ].filter((topic) =>
    required.filter((t) => t.topic_id === topic).every((t) => done.has(t.id)),
  );
  return {
    total: required.length,
    completed: completed.length,
    pending: required.length - completed.length,
    percentage: required.length
      ? Math.round((completed.length / required.length) * 100)
      : 0,
    completedDays: days,
    completedTopics: topics,
    nextTaskId: required.find((t) => !done.has(t.id))?.id || null,
    completions,
  };
}
module.exports = {
  fail,
  text,
  id,
  slug,
  integer,
  choice,
  boolean,
  url,
  status,
  access,
  exam,
  syllabus,
  topic,
  plan,
  task,
  resource,
  metadata,
  progress,
};
