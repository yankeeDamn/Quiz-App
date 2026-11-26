"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { admin } from "@/lib/admin";
import { Button } from "@/components/ui/button";
type Row = Record<string, unknown>;
type Readiness = {
  ready: boolean;
  revision: number;
  checks: { code: string; label: string; passed: boolean; issues: { code: string; message: string; day?: number; taskTitle?: string; taskId?: string }[] }[];
  review: { examStatus: string; syllabusVerified: boolean; draftTopics: number; archivedTopics: number };
};
type Inventory = {
  exams: Row[];
  syllabuses: Row[];
  topics: Row[];
  plans: Row[];
  resources: Row[];
  ebooks: Row[];
  mocks: Row[];
  bankTopics: Row[];
};
type Field = {
  key: string;
  label: string;
  kind?: "number" | "text" | "textarea" | "check" | "list";
  options?: { value: string; label: string }[];
  required?: boolean;
};
const asString = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v);
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const choices = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
const select = (key: string, label: string, values: string[]): Field => ({
  key,
  label,
  options: choices(values),
});
const status = select("status", "Publication status", [
  "draft",
  "published",
  "archived",
]);
const access = select("access_policy", "Access policy", ["pro", "free"]);
export function StudyPlanManager() {
  const [data, setData] = useState<Inventory | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [tab, setTab] = useState("plans"),
    [edit, setEdit] = useState<Row>({}),
    [selected, setSelected] = useState<Row | null>(null),
    [tasks, setTasks] = useState<Row[]>([]),
    [days, setDays] = useState<Row[]>([]);
  const [bank, setBank] = useState(""),
    [questions, setQuestions] = useState<Row[]>([]),
    [json, setJson] = useState(""),
    [report, setReport] = useState<Row | null>(null),
    [ack, setAck] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [review, setReview] = useState({ exam: false, syllabus: false, topics: false });
  const [reviewAck, setReviewAck] = useState(false);
  const [readinessError, setReadinessError] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const selectedId = asString(selected?.id);
  const selectedRevision = selected?.revision;
  const draftSelected = selected?.status === "draft";
  useEffect(() => {
    let cancelled = false;
    if (!selectedId || !draftSelected) return;
    void admin<Readiness>(`/study-plans/plans/${selectedId}/readiness`).then(r => {
      if (cancelled) return;
      if (r.ok) {
        setReadiness(r.data);
        setReadinessError("");
      } else {
        setReadiness(null);
        setReadinessError(r.message);
      }
    });
    return () => { cancelled = true; };
  }, [selectedId, selectedRevision, draftSelected, reload]);
  useEffect(() => {
    let cancelled = false;
    void admin<Inventory>("/study-plans").then((r) => {
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);
  async function call(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await admin<Row>("/study-plans" + path, method, body);
      if (!r.ok) throw Error(r.message);
      if (method !== "GET") {
        setReadiness(null);
        setAck(false);
        setReload((x) => x + 1);
        setNotice("Saved. Draft changes are not published automatically.");
      }
      return r.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function openPlan(p: Row) {
    setReadiness(null);
    setReadinessError("");
    setReview({ exam: false, syllabus: false, topics: false });
    setReviewAck(false);
    setAck(false);
    setDayFilter("");
    const r = await call("/plans/" + p.id, undefined, "GET");
    if (r) {
      setSelected(r);
      setTasks(r.tasks as Row[]);
      setDays(r.days as Row[]);
      setReload(x => x + 1);
      setEdit({});
      setAck(false);
    }
  }
  if (!data)
    return <div role="status">{error || "Loading Study Plan Manager…"}</div>;
  const options = (rows: Row[], label = "name", id = "id") =>
    rows.map((r) => ({
      value: asString(r[id]),
      label: asString(r[label] || r.title || r.id),
    }));
  const exam: Field = {
    key: "exam_id",
    label: "Exam",
    options: options(data.exams),
    required: true,
  };
  const syllabus: Field = {
    key: "syllabus_id",
    label: "Syllabus version",
    options: data.syllabuses.map((r) => ({
      value: asString(r.id),
      label: `${r.exam_id} · ${r.version}`,
    })),
    required: true,
  };
  const topic: Field = {
    key: "topic_id",
    label: "Syllabus topic",
    options: options(data.topics),
  };
  const title: Field = { key: "title", label: "Title", required: true };
  const description: Field = {
    key: "description",
    label: "Description / study guidance",
    kind: "textarea",
  };
  const order: Field = {
    key: "display_order",
    label: "Display order",
    kind: "number",
  };
  let fields: Field[] = [],
    records: Row[] = [],
    endpoint = "";
  if (tab === "exams") {
    records = data.exams;
    endpoint = "/exams";
    fields = [
      { key: "id", label: "Stable exam identifier", required: true },
      { key: "name", label: "Display name", required: true },
      description,
      { key: "category", label: "Exam category" },
      { key: "source_url", label: "Official syllabus source URL" },
      {
        key: "pattern_reference",
        label: "Exam pattern reference",
        kind: "textarea",
      },
      { key: "syllabus_version", label: "Applicable year / version" },
      status,
      access,
      order,
    ];
  }
  if (tab === "syllabuses") {
    records = data.syllabuses;
    endpoint = "/syllabuses";
    fields = [
      exam,
      { key: "version", label: "Year / syllabus version", required: true },
      { key: "source_url", label: "Official source URL", required: true },
      {
        key: "pattern_reference",
        label: "Pattern reference",
        kind: "textarea",
      },
      {
        key: "verified",
        label: "I verified the official source and syllabus version",
        kind: "check",
      },
    ];
  }
  if (tab === "topics") {
    records = data.topics;
    endpoint = "/topics";
    fields = [
      syllabus,
      select("kind", "Hierarchy level", [
        "stage",
        "subject",
        "chapter",
        "topic",
      ]),
      {
        key: "parent_id",
        label: "Parent (stage → subject → chapter → topic)",
        options: options(data.topics),
      },
      { key: "name", label: "Name", required: true },
      description,
      { key: "reference", label: "Syllabus reference" },
      { key: "objectives", label: "Learning objectives", kind: "textarea" },
      { key: "minutes", label: "Recommended minutes", kind: "number" },
      select("difficulty", "Difficulty", ["Moderate", "Easy", "Hard"]),
      {
        key: "prerequisites",
        label: "Prerequisite topic IDs (comma separated)",
        kind: "list",
      },
      order,
      status,
    ];
  }
  if (tab === "resources") {
    records = data.resources;
    endpoint = "/resources";
    fields = [
      exam,
      topic,
      title,
      description,
      select("kind", "Resource type", [
        "syllabus",
        "notes",
        "revision",
        "formula",
        "reference",
        "pyq",
        "other",
      ]),
      {
        key: "ebook_slug",
        label: "Existing Ebook Studio PDF",
        options: options(data.ebooks, "title", "slug"),
      },
      { key: "source_url", label: "Source / public reference URL" },
      { key: "attribution", label: "Source attribution", required: true },
      {
        key: "rights_notes",
        label: "Permission to distribute",
        kind: "textarea",
        required: true,
      },
      access,
      status,
    ];
  }
  if (tab === "plans" && !selected) {
    records = data.plans;
    endpoint = "/plans";
    fields = [
      { key: "slug", label: "Stable plan URL identifier", required: true },
      exam,
      syllabus,
      title,
      description,
      { key: "level", label: "Intended student level" },
      { key: "duration", label: "Plan duration in days", kind: "number" },
      {
        key: "daily_minutes",
        label: "Recommended daily minutes",
        kind: "number",
      },
      { key: "weekly_goals", label: "Weekly goals", kind: "textarea" },
      {
        key: "completion_criteria",
        label: "Completion criteria",
        kind: "textarea",
      },
      access,
    ];
  }
  const defaults: Row = {
    status: "draft",
    access_policy: "pro",
    display_order: 0,
    minutes: 30,
    duration: 30,
    daily_minutes: 60,
    level: "Foundation",
    kind: tab === "topics" ? "stage" : "notes",
    difficulty: "Moderate",
    required: true,
    preview: false,
    day: 1,
    ...edit,
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {["plans", "exams", "syllabuses", "topics", "resources", "pyqs"].map(
          (t) => (
            <Button
              key={t}
              variant={tab === t ? "default" : "outline"}
              onClick={() => {
                setTab(t);
                setEdit({});
                setSelected(null);
                setNotice("");
                setError("");
                setReadiness(null);
              }}
            >
              {t === "pyqs" ? "PYQs" : t[0].toUpperCase() + t.slice(1)}
            </Button>
          ),
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-300 p-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {tab === "resources" && (
        <p className="rounded-xl bg-muted p-4 text-sm">
          Upload or replace PDFs in{" "}
          <Link className="underline" href="/certifications?tab=start-learning">
            Ebook Studio
          </Link>
          , then attach them here. For new premium study PDFs, choose “Study
          Plans: Pro subscribers only” before creating the ebook. Existing ebook
          purchases retain their scope.
        </p>
      )}
      {tab === "syllabuses" && (
        <p className="text-sm text-muted-foreground">
          Record the exact official source and year. Published editions freeze
          their syllabus; use a new version for later changes.
        </p>
      )}
      {fields.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold">Saved {tab}</h2>
            {!records.length && (
              <p className="text-sm text-muted-foreground">
                No records yet. Create a draft to begin.
              </p>
            )}
            {records.map((r) => (
              <button
                key={asString(r.id)}
                className="block w-full rounded-lg border p-3 text-left text-sm hover:bg-muted"
                onClick={() =>
                  tab === "plans"
                    ? openPlan(r)
                    : setEdit({ ...r, verified: !!r.verified_at })
                }
              >
                <strong>{asString(r.title || r.name || r.version)}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {asString(r.id)} · {asString(r.status || r.exam_id)}{" "}
                  {r.edition ? `· edition ${r.edition}` : ""}
                </span>
              </button>
            ))}
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex justify-between">
              <h2 className="font-bold">
                {edit.id ? "Edit record" : "Create draft"}
              </h2>
              <Button variant="outline" onClick={() => setEdit({})}>
                New
              </Button>
            </div>
            <Editor
              key={asString(edit.id) || "new-" + tab}
              fields={fields}
              initial={defaults}
              busy={busy}
              onSave={async (value) => {
                const isUpdate =
                  !!edit.id &&
                  ["exams", "topics", "resources", "syllabuses"].includes(tab);
                const saved = await call(
                  endpoint + (isUpdate ? "/" + edit.id : ""),
                  value,
                  isUpdate ? "PUT" : "POST",
                );
                if (saved) setEdit(saved);
              }}
            />
          </section>
        </div>
      )}
      {tab === "plans" && selected && (
        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setEdit({});
              }}
            >
              All plans
            </Button>
            <h2 className="text-xl font-bold">
              {asString(selected.title)} · edition {asString(selected.edition)}
            </h2>
            <span className="text-sm">{asString(selected.status)}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link
                href={`/admin/study-plans/preview/${selected.id}`}
                target="_blank"
              >
                Preview as student
              </Link>
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={async () => {
                const r = await call(`/plans/${selected.id}/clone`, {});
                if (r) await openPlan(r);
              }}
            >
              Clone new draft edition
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={async () => {
                if (
                  window.confirm(
                    "Archive this edition? Students will lose content access; their progress will be retained.",
                  )
                ) {
                  const r = await call(`/plans/${selected.id}/archive`, {});
                  if (r) await openPlan(r);
                }
              }}
            >
              Archive edition
            </Button>
          </div>
          {selected.status === "draft" && (
            <>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold">
                  Edit plan settings
                </summary>
                <Editor
                  key={asString(selected.id) + selected.revision}
                  initial={selected}
                  busy={busy}
                  fields={[
                    { key: "slug", label: "Identifier", required: true },
                    exam,
                    syllabus,
                    title,
                    description,
                    { key: "level", label: "Student level" },
                    { key: "duration", label: "Days", kind: "number" },
                    {
                      key: "daily_minutes",
                      label: "Minutes/day",
                      kind: "number",
                    },
                    {
                      key: "weekly_goals",
                      label: "Weekly goals",
                      kind: "textarea",
                    },
                    {
                      key: "completion_criteria",
                      label: "Completion criteria",
                      kind: "textarea",
                    },
                    access,
                  ]}
                  onSave={async (value) => {
                    const r = await call(`/plans/${selected.id}`, value, "PUT");
                    if (r) await openPlan(r);
                  }}
                />
              </details>
              <section className="space-y-4 rounded-xl border p-4" aria-label="Publication readiness">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">Publication readiness</h3>
                  <Button variant="outline" disabled={busy} onClick={() => { setReadiness(null); setAck(false); setReload(x => x + 1); }}>Refresh checks</Button>
                </div>
                <p className="text-sm text-muted-foreground">Review all blockers before publishing. This checklist never publishes your plan.</p>
                {readinessError && <p role="alert" className="text-sm">{readinessError}</p>}
                {!readiness && !readinessError && <p role="status">Checking prerequisites…</p>}
                {readiness && (
                  <>
                    <p role="status" className="font-semibold">{readiness.ready ? "Ready for final review" : `${readiness.checks.filter(c => !c.passed).length} checks need attention`}</p>
                    <ul className="space-y-2">
                      {readiness.checks.map(check => (
                        <li key={check.code} className="rounded-lg border p-3 text-sm">
                          <strong>{check.passed ? "Passed" : "Action required"} · {check.label}</strong>
                          {!check.passed && <ul className="mt-2 list-disc space-y-1 pl-5">{check.issues.map((issue,i) => <li key={i}>{issue.day ? `Day ${issue.day} · ${issue.taskTitle}: ` : ""}{issue.message}{issue.taskId && <Button variant="outline" className="ml-2" onClick={() => { const t = tasks.find(t => t.id === issue.taskId); if (t) { setDayFilter(asString(t.day)); setEdit({...t,objectives:days.find(d=>d.day===t.day)?.objectives || ""}); } }}>Find task</Button>}</li>)}</ul>}
                        </li>
                      ))}
                    </ul>
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer font-semibold">Bulk prerequisite review</summary>
                      <p className="my-2 text-sm">Only select records you personally reviewed. Exam and topic review changes their prerequisite status to published, but does not publish this plan or activate any mocks. This applies to the selected syllabus version, including all its draft topics.</p>
                      <div className="space-y-3">
                        {([{key:"exam",label:`Mark exam reviewed (${readiness.review.examStatus})`,disabled:readiness.review.examStatus!=="draft"},{key:"syllabus",label:`Verify official syllabus (${readiness.review.syllabusVerified?"verified":"unverified"})`,disabled:readiness.review.syllabusVerified},{key:"topics",label:`Mark all ${readiness.review.draftTopics} draft syllabus nodes reviewed`,disabled:!readiness.review.draftTopics}] as const).map(item => (
                          <label key={item.key} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" disabled={busy || item.disabled} checked={review[item.key]} onChange={e=>{setReview(old=>({...old,[item.key]:e.target.checked}));setReviewAck(false);}} />{item.label}
                          </label>
                        ))}
                        {readiness.review.archivedTopics > 0 && <p className="text-sm">Archived topics are not changed by bulk review.</p>}
                        <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewAck} onChange={e=>setReviewAck(e.target.checked)} />I have checked the selected records and understand this changes their prerequisite status, not the plan’s publication status.</label>
                        <Button variant="outline" disabled={busy || !reviewAck || !Object.values(review).some(Boolean) || readiness.revision !== selected.revision} onClick={async()=>{const r=await call(`/plans/${selected.id}/review-prerequisites`,{...review,acknowledged:true,revision:readiness.revision});if(r)await openPlan(r);}}>Apply selected prerequisite reviews</Button>
                      </div>
                    </details>
                  </>
                )}
              </section>
              <div className="rounded-lg border p-4">
                <label className="flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={ack}
                    disabled={!readiness?.ready || readiness.revision !== selected.revision}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I reviewed the official syllabus, linked content, distribution
                  rights and student preview. Publish this edition.
                </label>
                <Button
                  className="mt-3"
                  disabled={busy || !ack || !readiness?.ready || readiness.revision !== selected.revision}
                  onClick={async () => {
                    if (!window.confirm("Publish this edition to the student catalogue?")) return;
                    const r = await call(`/plans/${selected.id}/publish`, {
                      revision: selected.revision,
                      acknowledged: ack,
                    });
                    if (r) await openPlan(r);
                    else { setAck(false); setReadiness(null); setReload(x => x + 1); }
                  }}
                >
                  Publish reviewed edition
                </Button>
              </div>
            </>
          )}
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-bold">Ordered daily tasks</h3>
              <label className="block text-sm">Filter by day
                <select className={input} value={dayFilter} onChange={e=>setDayFilter(e.target.value)}>
                  <option value="">All days</option>
                  {days.map(d=><option key={asString(d.day)} value={asString(d.day)}>Day {asString(d.day)}</option>)}
                </select>
              </label>
              {tasks.filter(t=>!dayFilter || asString(t.day)===dayFilter).map((t) => (
                <button
                  className="block w-full rounded-lg border p-3 text-left text-sm"
                  key={asString(t.id)}
                  onClick={() =>
                    setEdit({
                      ...t,
                      objectives:
                        days.find((d) => d.day === t.day)?.objectives || "",
                    })
                  }
                >
                  Day {asString(t.day)} · {asString(t.display_order)} ·{" "}
                  {asString(t.title)}
                  <span className="block text-xs text-muted-foreground">
                    {asString(t.kind)} ·{" "}
                    {t.preview ? "Free preview" : "Full plan"}
                  </span>
                </button>
              ))}
            </div>
            {selected.status === "draft" && (
              <div>
                <div className="mb-3 flex justify-between">
                  <h3 className="font-bold">
                    {edit.id ? "Edit task" : "Add task"}
                  </h3>
                  <Button variant="outline" onClick={() => setEdit({})}>
                    New task
                  </Button>
                </div>
                <Editor
                  key={asString(edit.id) || "new-task"}
                  busy={busy}
                  initial={{ ...defaults, kind: edit.kind || "reading" }}
                  fields={[
                    { key: "day", label: "Day number", kind: "number" },
                    {
                      key: "objectives",
                      label: "Daily learning objectives",
                      kind: "textarea",
                    },
                    title,
                    description,
                    select("kind", "Task type", [
                      "reading",
                      "pdf",
                      "pyq",
                      "quiz",
                      "mock",
                      "revision",
                      "guidance",
                    ]),
                    topic,
                    {
                      key: "minutes",
                      label: "Estimated minutes",
                      kind: "number",
                    },
                    order,
                    {
                      key: "required",
                      label: "Required for completion",
                      kind: "check",
                    },
                    {
                      key: "preview",
                      label: "Include in Free preview",
                      kind: "check",
                    },
                    {
                      key: "resource_id",
                      label: "Learning resource",
                      options: options(data.resources, "title"),
                    },
                    {
                      key: "mock_id",
                      label: "Existing mock / practice quiz",
                      options: options(data.mocks),
                    },
                    {
                      key: "question_ids",
                      label:
                        "Existing question UUIDs (comma separated; find them in PYQs)",
                      kind: "list",
                    },
                  ]}
                  onSave={async (value) => {
                    const r = await call(
                      `/plans/${selected.id}/tasks${edit.id ? "/" + edit.id : ""}`,
                      value,
                      edit.id ? "PUT" : "POST",
                    );
                    if (r) {
                      await openPlan(selected);
                      setEdit({});
                    }
                  }}
                />
              </div>
            )}
          </div>
        </section>
      )}
      {tab === "pyqs" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h2 className="font-bold">Existing question bank & PYQ provenance</h2>
          <label className="block text-sm">
            Question-bank topic
            <select
              className={input}
              value={bank}
              onChange={async (e) => {
                setBank(e.target.value);
                setReport(null);
                if (e.target.value) {
                  const r = await admin<Row[]>(
                    "/study-plans/questions/" + e.target.value,
                  );
                  if (r.ok) setQuestions(r.data);
                  else setError(r.message);
                }
              }}
            >
              <option value="">Choose a bank topic</option>
              {data.bankTopics.map((t) => (
                <option key={asString(t.id)} value={asString(t.id)}>
                  {asString(t.name)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            Use the existing{" "}
            <Link href="/admin?section=questions" className="underline">
              Question Bank
            </Link>{" "}
            to enter/edit question text and answers. Linking below preserves
            each question ID.
          </p>
          <div className="max-h-72 space-y-2 overflow-auto">
            {questions.map((q) => (
              <button
                className="block w-full rounded-lg border p-3 text-left text-sm"
                key={asString(q.id)}
                onClick={() =>
                  setEdit({
                    ...q,
                    question_id: q.id,
                    topic_id: q.syllabus_topic_id,
                  })
                }
              >
                {asString(q.question)}
                <span className="block break-all text-xs text-muted-foreground">
                  {asString(q.id)} · {asString(q.review_status)} ·{" "}
                  {asString(q.verification || "No PYQ metadata")}
                </span>
              </button>
            ))}
          </div>
          <Editor
            key={asString(edit.question_id) || "metadata"}
            busy={busy}
            initial={{ verification: "unverified", language: "en", ...edit }}
            fields={[
              {
                key: "question_id",
                label: "Existing question UUID",
                required: true,
              },
              exam,
              topic,
              {
                key: "exam_year",
                label: "Verified exam year (leave blank if unknown)",
                kind: "number",
              },
              { key: "stage", label: "Tier / stage" },
              { key: "session", label: "Verified shift / session" },
              { key: "language", label: "Language" },
              { key: "source", label: "Source and answer-key reference" },
              select("verification", "Verification status", [
                "unverified",
                "verified",
              ]),
              {
                key: "rights_notes",
                label: "Rights / distribution notes",
                kind: "textarea",
              },
            ]}
            onSave={(value) =>
              call("/pyqs/" + value.question_id, value, "PUT").then(() => {})
            }
          />
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-bold">
              Bulk JSON import with validation preview
            </summary>
            <p className="my-3 text-sm">
              Use existing question fields: question, options (four strings),
              answer (0–3), explanation, difficulty. Add a pyq object with
              exam_id, topic_id, exam_year, stage, session, language, source,
              rights_notes. New imports always await human verification.
              Duplicate questions are rejected; link the existing ID instead.
            </p>
            <label className="block text-sm">
              Import file
              <input
                type="file"
                accept="application/json,.json"
                className={input}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 900000) {
                      setError("Import must be smaller than 900 KB");
                      return;
                    }
                    setJson(await f.text());
                    setReport(null);
                  }
                }}
              />
            </label>
            <label className="block text-sm">
              JSON rows
              <textarea
                className={input + " min-h-36 font-mono"}
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setReport(null);
                }}
              />
            </label>
            <div className="mt-3 flex gap-3">
              <Button
                disabled={!bank || busy}
                onClick={async () => {
                  try {
                    const r = await call(`/pyqs/import/${bank}/preview`, {
                      rows: JSON.parse(json),
                    });
                    setReport(r);
                  } catch {
                    setError("Invalid JSON. Supply an array of question rows.");
                  }
                }}
              >
                Preview import
              </Button>
              <Button
                disabled={!bank || busy || report?.valid !== true}
                onClick={async () => {
                  try {
                    const r = await call(`/pyqs/import/${bank}/commit`, {
                      rows: JSON.parse(json),
                      previewed: true,
                    });
                    setReport(r);
                  } catch {
                    setError("Invalid JSON");
                  }
                }}
              >
                Import validated rows
              </Button>
            </div>
            {report && (
              <pre
                className="mt-3 overflow-auto whitespace-pre-wrap text-xs"
                role="status"
              >
                {JSON.stringify(report, null, 2)}
              </pre>
            )}
          </details>
        </section>
      )}
    </div>
  );
}
function Editor({
  fields,
  initial,
  busy,
  onSave,
}: {
  fields: Field[];
  initial: Row;
  busy: boolean;
  onSave: (value: Row) => Promise<unknown>;
}) {
  const [value, setValue] = useState<Row>(() =>
    Object.fromEntries(
      Object.entries(initial).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(", ") : v,
      ]),
    ),
  );
  const change = (key: string, v: unknown) =>
    setValue((old) => ({ ...old, [key]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          ...value,
          ...Object.fromEntries(
            fields
              .filter((f) => f.kind === "list")
              .map((f) => [
                f.key,
                asString(value[f.key])
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              ]),
          ),
        });
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className="block text-sm font-medium">
          {f.kind === "check" ? (
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value[f.key] === true}
                onChange={(e) => change(f.key, e.target.checked)}
              />
              {f.label}
            </span>
          ) : (
            <>
              <span className="mb-1 block">{f.label}</span>
              {f.options ? (
                <select
                  required={f.required}
                  className={input}
                  value={asString(value[f.key])}
                  onChange={(e) => change(f.key, e.target.value)}
                >
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.kind === "textarea" ? (
                <textarea
                  required={f.required}
                  className={input + " min-h-24"}
                  value={asString(value[f.key])}
                  onChange={(e) => change(f.key, e.target.value)}
                />
              ) : (
                <input
                  required={f.required}
                  type={f.kind === "number" ? "number" : "text"}
                  className={input}
                  value={
                    Array.isArray(value[f.key])
                      ? (value[f.key] as string[]).join(", ")
                      : asString(value[f.key])
                  }
                  onChange={(e) =>
                    change(
                      f.key,
                      f.kind === "number"
                        ? e.target.value === ""
                          ? null
                          : Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              )}
            </>
          )}
        </label>
      ))}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
