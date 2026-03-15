// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import createRoute from "./create";
import listRoute from "./list";
import getRoute from "./get";
import updateRoute from "./update";
import deleteRoute from "./delete";

// ** import types
import type { AppEnv } from "@/types";

const projectsRouter = new Hono<AppEnv>();

// Apply auth middleware to all routes
projectsRouter.use("*", authMiddleware);
projectsRouter.use("*", requireAuth);

projectsRouter.route("/", createRoute);
projectsRouter.route("/", listRoute);
projectsRouter.route("/", getRoute);
projectsRouter.route("/", updateRoute);
projectsRouter.route("/", deleteRoute);

export default projectsRouter;
