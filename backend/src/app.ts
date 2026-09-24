import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { authenticate } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { usersRouter } from "./modules/users/users.routes";
import { studiesRouter } from "./modules/studies/studies.routes";
import { studyTypesRouter } from "./modules/studyTypes/studyTypes.routes";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";

export function createApp() {
  const app = express();

  // Spec 60: HTTPS is terminated upstream (load balancer / reverse proxy)
  // in production; helmet covers the remaining baseline HTTP security headers.
  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl ?? true }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // usersRouter owns the public /auth/dev-login route and applies
  // `authenticate` internally to everything declared after it.
  app.use("/api/v1", usersRouter);

  // Spec 50-51: every other route requires an authenticated user; specific
  // routes layer `requireRole`/`requireAdmin` on top for RBAC (spec 3).
  app.use("/api/v1", authenticate, studiesRouter, studyTypesRouter, tasksRouter, dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
