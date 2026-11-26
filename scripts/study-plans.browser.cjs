"use strict";
// UI-only fixtures. Real authorization/SQL coverage lives in the integration test.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const serverLog = fs.openSync("/tmp/study-browser-server.log", "w");
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3309"],
  {
    cwd: path.join(__dirname, "../exam-practice-pro"),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:45450",
      NEXT_PUBLIC_APP_ENV: "local",
      AUTH_SECRET: "local-ui-fixture-only",
    },
    stdio: ["ignore", serverLog, serverLog],
  },
);
const plan = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "ssc-cgl",
  edition: 1,
  title: "SSC CGL sample plan",
  name: "SSC CGL",
  description: "UI fixture — no production content",
  syllabus_version: "Fixture",
  duration: 2,
  daily_minutes: 30,
  access_policy: "pro",
  access: true,
  preview: true,
  subjects: ["Reasoning"],
  modules: 2,
  days: [
    { day: 1, objectives: "Learn and practise", tasks: 1, previews: 1 },
    { day: 2, objectives: "Revise", tasks: 1, previews: 0 },
  ],
  progress: {
    percentage: 0,
    completed: 0,
    pending: 1,
    completedDays: [],
    completedTopics: [],
    completions: [],
    enrollment: { start_date: "2026-11-26", current_day: 1 },
    results: [],
  },
};
async function main() {
  let browser;
  try {
    let ready=false;
    for (let i = 0; i < 12; i++) {
      try {
        const r = await fetch("http://127.0.0.1:3309/study-plans", {
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {ready=true;break;}
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if(!ready)throw new Error("Next dev did not become ready; inspect /tmp/study-browser-server.log");
    browser = await chromium.launch({
      ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
      headless: true,
      args: ["--no-sandbox"],
    });
    console.log("BROWSER_STARTED");
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.route("**/api/auth/session", (r) =>
      r.fulfill({
        json: {
          user: { email: "study-owner@example.test", name: "Owner" },
          expires: "2099-01-01",
        },
      }),
    );
    await page.route("**/api/auth/backend-token", (r) =>
      r.fulfill({ json: { token: "UI_FIXTURE_NOT_A_REAL_TOKEN" } }),
    );
    await page.route("http://127.0.0.1:45450/**", async (r) => {
      const p = new URL(r.request().url()).pathname;
      let data;
      if (p === "/api/v1/admin/me")
        data = { via: "account", email: "study-owner@example.test" };
      else if (p === "/api/v1/admin/study-plans")
        data = {
          exams: [],
          syllabuses: [],
          topics: [],
          plans: [],
          resources: [],
          ebooks: [],
          mocks: [],
          bankTopics: [],
        };
      else if (p.endsWith("/complete")) {
        plan.progress.percentage = 100;
        plan.progress.completed = 1;
        plan.progress.pending = 0;
        plan.progress.completions = [
          { task_id: "task-1", completed_at: new Date().toISOString() },
        ];
        data = plan.progress;
      } else if (p.endsWith("/day/1"))
        data = {
          planId: plan.id,
          title: plan.title,
          day: 1,
          duration: 2,
          objectives: "Learn and practise",
          access: true,
          tasks: [
            {
              id: "task-1",
              day: 1,
              title: "Read the approved notes",
              description: "Review the topic and write a short explanation.",
              kind: "reading",
              minutes: 30,
              required: true,
              preview: true,
              mock_id: null,
              questions: [],
              resource: null,
            },
          ],
        };
      else if (p.endsWith("/study-plans/ssc-cgl")) data = plan;
      else if (p.endsWith("/study-plans"))
        data = {
          plans: [plan],
          upcoming: [
            {
              id: "railway-rrb",
              name: "Railway RRB",
              description: "Preparation plans for Railway examinations.",
            },
          ],
        };
      else data = {};
      await r.fulfill({
        json: { success: true, data },
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    });
    await page.goto("http://127.0.0.1:3309/study-plans");
    await page.getByRole("heading", { name: "SSC CGL sample plan" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "/tmp/study-catalogue-mobile.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Open plan", exact: true }).click();
    await page.getByRole("heading", { name: "Your progress" }).waitFor();
    await page.goto("http://127.0.0.1:3309/study-plans/ssc-cgl/day/1");
    await page.getByLabel("Mark task complete").waitFor();
    assert.equal(
      await page.getByLabel("Mark task complete").isChecked(),
      false,
    );
    await page.getByLabel("Mark task complete").check();
    await page.getByText("100%", { exact: true }).waitFor();
    await page.screenshot({
      path: "/tmp/study-day-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:3309/admin?section=study-plans");
    await page.getByRole("heading", { name: "Saved plans" }).waitFor();
    await page.getByRole("button", { name: "Exams", exact: true }).click();
    await page.getByLabel("Stable exam identifier").fill("ssc-cgl");
    await page.getByLabel("Display name", { exact: true }).fill("SSC CGL");
    await page.screenshot({
      path: "/tmp/study-admin-desktop.png",
      fullPage: true,
    });
    console.log(
      "PASS: mobile catalogue/navigation, daily explicit completion, no overflow, admin manager/forms",
    );
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
