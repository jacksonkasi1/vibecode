// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import createRoute from "./create";
import listRoute from "./list";
import getRoute from "./get";
import updateRoute from "./update";
import startRoute from "./start";
import stopRoute from "./stop";
import deleteRoute from "./delete";

// ** import types
import type { AppEnv } from "@/types";

const workspacesRouter = new Hono<AppEnv>();

// Apply auth middleware to all routes
workspacesRouter.use("*", authMiddleware);
workspacesRouter.use("*", requireAuth);

workspacesRouter.route("/", createRoute);
workspacesRouter.route("/", listRoute);
workspacesRouter.route("/", getRoute);
workspacesRouter.route("/", updateRoute);
workspacesRouter.route("/", startRoute);
workspacesRouter.route("/", stopRoute);
workspacesRouter.route("/", deleteRoute);

export default workspacesRouter;
