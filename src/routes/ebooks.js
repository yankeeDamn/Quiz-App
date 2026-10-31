"use strict";
const { Router } = require("express");
const service = require("../services/ebooks.service");
const { authenticateNextAuth } = require("../middleware/nextauth");
const { adminLimiter } = require("../middleware/rate-limiter");
function createRouters(books = service, identity = authenticateNextAuth) {
  const router = Router(),
    adminRouter = Router();
  const ok = (res, data) => res.json({ success: true, data });
  const wrap = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error.code === "23505")
        return res
          .status(409)
          .json({
            success: false,
            error: {
              code: "EBOOK_CONFLICT",
              message: "This ebook slug is already in use.",
            },
          });
      if (error.code === "42P01")
        return res
          .status(503)
          .json({
            success: false,
            error: {
              code: "EBOOK_SETUP_REQUIRED",
              message: "The ebook database migration has not been applied yet.",
            },
          });
      if (error.statusCode)
        return res
          .status(error.statusCode)
          .json({
            success: false,
            error: { code: error.code, message: error.message },
          });
      next(error);
    }
  };
  const optional = (req, res, next) =>
    req.headers.authorization ? identity(req, res, next) : next();
  const privateHeaders = (_req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    res.set("Vary", "Authorization");
    next();
  };
  router.use(privateHeaders);
  adminRouter.use(privateHeaders, adminLimiter, identity);
  router.get("/capabilities", optional, (req, res) =>
    ok(res, { isOwnerAdmin: service.isOwnerAdmin(req.user) }),
  );
  router.get(
    "/attempts",
    identity,
    wrap(async (req, res) =>
      ok(res, { attempts: await books.history(req.user) }),
    ),
  );
  router.get(
    "/attempts/:id",
    identity,
    wrap(async (req, res) =>
      ok(res, { attempt: await books.attempt(req.params.id, req.user) }),
    ),
  );
  router.put(
    "/attempts/:id",
    identity,
    wrap(async (req, res) =>
      ok(res, {
        attempt: await books.attempt(req.params.id, req.user, req.body),
      }),
    ),
  );
  router.post(
    "/attempts/:id/submit",
    identity,
    wrap(async (req, res) =>
      ok(res, {
        attempt: await books.attempt(req.params.id, req.user, req.body, true),
      }),
    ),
  );
  router.post(
    "/attempts/:id/share",
    identity,
    wrap(async (req, res) =>
      ok(res, await books.share(req.params.id, req.user)),
    ),
  );
  router.get(
    "/certificates/:id",
    wrap(async (req, res) =>
      ok(res, { certificate: await books.certificate(req.params.id) }),
    ),
  );
  router.get(
    "/",
    optional,
    wrap(async (req, res) => ok(res, { ebooks: await books.list(req.user) })),
  );
  router.get(
    "/:slug/practice",
    optional,
    wrap(async (req, res) =>
      ok(res, { questions: await books.practice(req.params.slug, req.user) }),
    ),
  );
  router.get(
    "/:slug",
    optional,
    wrap(async (req, res) =>
      ok(res, { ebook: await books.get(req.params.slug, req.user) }),
    ),
  );
  router.post(
    "/:slug/request-access",
    identity,
    wrap(async (req, res) => {
      await books.requestAccess(req.params.slug, req.user, req.body.note);
      ok(res, { requested: true });
    }),
  );
  router.get(
    "/:slug/progress",
    identity,
    wrap(async (req, res) =>
      ok(res, await books.progress(req.params.slug, req.user)),
    ),
  );
  router.put(
    "/:slug/progress",
    identity,
    wrap(async (req, res) =>
      ok(res, await books.progress(req.params.slug, req.user, req.body)),
    ),
  );
  router.post(
    "/:slug/attempts",
    identity,
    wrap(async (req, res) =>
      ok(res, {
        attempt: await books.start(req.params.slug, req.user, req.body),
      }),
    ),
  );
  adminRouter.get(
    "/requests",
    wrap(async (req, res) =>
      ok(res, { requests: await books.accessQueue(req.user) }),
    ),
  );
  adminRouter.post(
    "/",
    wrap(async (req, res) =>
      ok(res, {
        ebook: await books.save(
          String(req.body.slug || ""),
          req.body,
          req.user,
          true,
        ),
      }),
    ),
  );
  adminRouter.put(
    "/:slug",
    wrap(async (req, res) =>
      ok(res, { ebook: await books.save(req.params.slug, req.body, req.user) }),
    ),
  );
  adminRouter.delete(
    "/:slug",
    wrap(async (req, res) => {
      await books.archive(req.params.slug, req.user);
      ok(res, { archived: true });
    }),
  );
  adminRouter.post(
    "/:slug/approve-access",
    wrap(async (req, res) => {
      await books.approve(req.params.slug, req.user, req.body);
      ok(res, { updated: true });
    }),
  );
  return { router, adminRouter };
}
module.exports = { ...createRouters(), createRouters };
