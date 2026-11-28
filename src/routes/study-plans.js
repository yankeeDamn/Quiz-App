"use strict";
const { Router } = require("express");
const service = require("../services/study-plans.service");
const { authenticateNextAuth } = require("../middleware/nextauth");
const { adminLimiter } = require("../middleware/rate-limiter");
const logger = require("../utils/logger");
function createRouters(s = service, identity = authenticateNextAuth) {
  const router = Router(),
    adminRouter = Router();
  const wrap = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      const status =
        e.statusCode ||
        { 23505: 409, 23503: 400, 23514: 400, "22P02": 400, "42P01": 503 }[
          e.code
        ];
      if (status)
        return res
          .status(status)
          .json({
            success: false,
            error: {
              code: "STUDY_PLAN_ERROR",
              message: e.statusCode
                ? e.message
                : e.code === "42P01"
                  ? "Study Plans setup is not complete."
                  : "Invalid or conflicting reference. Reload and check the selected records.",
            },
          });
      next(e);
    }
  };
  const ok = (res, data) => res.json({ success: true, data });
  const optional = (req, res, next) =>
    req.headers.authorization ? identity(req, res, next) : next();
  const privateHeaders = (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("Vary", "Authorization");
    next();
  };
  router.use(privateHeaders);
  adminRouter.use(privateHeaders, adminLimiter, identity);
  adminRouter.use((req, res, next) => {
    try {
      s.admin(req.user);
      next();
    } catch (e) {
      res.status(403).json({ success: false, error: { message: e.message } });
    }
  });
  adminRouter.use((req, _res, next) => {
    if (req.method !== "GET")
      logger.info(
        { actor: req.user.email, method: req.method, path: req.path },
        "Study admin action",
      );
    next();
  });
  router.get(
    "/",
    optional,
    wrap(async (req, res) => ok(res, await s.catalogue(req.user))),
  );
  router.get(
    "/:slug",
    optional,
    wrap(async (req, res) =>
      ok(res, await s.overview(req.params.slug, req.user)),
    ),
  );
  router.get(
    "/:slug/day/:day",
    optional,
    wrap(async (req, res) =>
      ok(res, await s.day(req.params.slug, Number(req.params.day), req.user)),
    ),
  );
  router.post(
    "/:slug/enroll",
    identity,
    wrap(async (req, res) =>
      ok(res, await s.enroll(req.params.slug, req.user, req.body)),
    ),
  );
  router.put(
    "/:slug/tasks/:task/complete",
    identity,
    wrap(async (req, res) =>
      ok(
        res,
        await s.complete(req.params.slug, req.params.task, req.user, req.body),
      ),
    ),
  );
  router.post(
    "/:slug/tasks/:task/questions/:question/answer",
    optional,
    wrap(async (req, res) =>
      ok(
        res,
        await s.answer(
          req.params.slug,
          req.params.task,
          req.params.question,
          req.user,
          req.body,
        ),
      ),
    ),
  );
  router.get(
    "/:slug/tasks/:task/resource",
    optional,
    wrap(async (req, res) => {
      const asset = await s.resource(
        req.params.slug,
        req.params.task,
        req.user,
        req.query.download === "1",
      );
      if (asset.url) return ok(res, asset);
      res
        .type("application/pdf")
        .set("X-Content-Type-Options", "nosniff")
        .set(
          "Content-Disposition",
          `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
        )
        .send(asset.bytes);
    }),
  );
  adminRouter.get(
    "/",
    wrap(async (req, res) => ok(res, await s.adminList(req.user))),
  );
  adminRouter.post(
    "/exams",
    wrap(async (req, res) => ok(res, await s.saveExam(req.user, req.body))),
  );
  adminRouter.put(
    "/exams/:id",
    wrap(async (req, res) =>
      ok(res, await s.saveExam(req.user, req.body, req.params.id)),
    ),
  );
  adminRouter.post(
    "/syllabuses",
    wrap(async (req, res) => ok(res, await s.saveSyllabus(req.user, req.body))),
  );
  adminRouter.put(
    "/syllabuses/:id",
    wrap(async (req, res) =>
      ok(res, await s.saveSyllabus(req.user, req.body, req.params.id)),
    ),
  );
  adminRouter.post(
    "/topics",
    wrap(async (req, res) => ok(res, await s.saveTopic(req.user, req.body))),
  );
  adminRouter.put(
    "/topics/:id",
    wrap(async (req, res) =>
      ok(res, await s.saveTopic(req.user, req.body, req.params.id)),
    ),
  );
  adminRouter.post(
    "/resources",
    wrap(async (req, res) => ok(res, await s.saveResource(req.user, req.body))),
  );
  adminRouter.put(
    "/resources/:id",
    wrap(async (req, res) =>
      ok(res, await s.saveResource(req.user, req.body, req.params.id)),
    ),
  );
  adminRouter.post(
    "/plans",
    wrap(async (req, res) => ok(res, await s.savePlan(req.user, req.body))),
  );
  adminRouter.put(
    "/plans/:id",
    wrap(async (req, res) =>
      ok(res, await s.savePlan(req.user, req.body, req.params.id)),
    ),
  );
  adminRouter.get(
    "/plans/:id",
    wrap(async (req, res) => ok(res, await s.detail(req.user, req.params.id))),
  );
  adminRouter.get(
    "/plans/:id/readiness",
    wrap(async (req, res) => ok(res, await s.readiness(req.user, req.params.id))),
  );
  adminRouter.post(
    "/plans/:id/review-prerequisites",
    wrap(async (req, res) => ok(res, await s.reviewPrerequisites(req.user, req.params.id, req.body))),
  );
  adminRouter.post(
    "/plans/:id/tasks",
    wrap(async (req, res) =>
      ok(res, await s.saveTask(req.user, req.params.id, req.body)),
    ),
  );
  adminRouter.put(
    "/plans/:id/tasks/:task",
    wrap(async (req, res) =>
      ok(
        res,
        await s.saveTask(req.user, req.params.id, req.body, req.params.task),
      ),
    ),
  );
  adminRouter.get(
    "/plans/:id/preview",
    wrap(async (req, res) =>
      ok(res, await s.overview("", req.user, req.params.id)),
    ),
  );
  adminRouter.get(
    "/plans/:id/preview/day/:day",
    wrap(async (req, res) =>
      ok(res, await s.day("", Number(req.params.day), req.user, req.params.id)),
    ),
  );
  adminRouter.get("/plans/:id/publication-history",wrap(async(req,res)=>ok(res,await s.publicationHistory(req.user,req.params.id))));
  adminRouter.post("/plans/:id/schedule",wrap(async(req,res)=>ok(res,await s.schedulePublication(req.user,req.params.id,req.body))));
  adminRouter.delete("/plans/:id/schedule",wrap(async(req,res)=>ok(res,await s.cancelPublication(req.user,req.params.id))));
  for (const action of ["publish", "archive", "clone"])
    adminRouter.post(
      `/plans/:id/${action}`,
      wrap(async (req, res) =>
        ok(res, await s[action](req.user, req.params.id, req.body)),
      ),
    );
  adminRouter.get(
    "/questions/:topic",
    wrap(async (req, res) =>
      ok(res, await s.questionSearch(req.user, req.params.topic)),
    ),
  );
  adminRouter.post(
    "/pyqs/import/:topic/preview",
    wrap(async (req, res) =>
      ok(
        res,
        await require("../services/question-import").preview(
          require("../services/study-plans.validation").slug(req.params.topic),
          req.body.rows,
          { pyq: true },
        ),
      ),
    ),
  );
  adminRouter.post(
    "/pyqs/import/:topic/commit",
    wrap(async (req, res) => {
      if (req.body.previewed !== true)
        throw require("../services/study-plans.validation").fail(
          "Preview the import before committing",
        );
      ok(
        res,
        await require("../services/question-import").importRows(
          require("../services/study-plans.validation").slug(req.params.topic),
          req.body.rows,
          { pyq: true, actor: req.user.email },
        ),
      );
    }),
  );
  adminRouter.put(
    "/pyqs/:id",
    wrap(async (req, res) =>
      ok(res, await s.pyqLink(req.user, req.params.id, req.body)),
    ),
  );
  return { router, adminRouter };
}
module.exports = { ...createRouters(), createRouters };
