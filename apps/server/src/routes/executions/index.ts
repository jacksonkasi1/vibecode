// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import createRoute from "./create";
import listRoute from "./list";
import getRoute from "./get";
import cancelRoute from "./cancel";
import undoRoute from "./undo";
import forceMergeRoute from "./force-merge";
import streamRoute from "./stream";
import agentsRoute from "./agents";
import eventsRoute from "./events";

// ** import types
import type { AppEnv } from "@/types";

const executionsRouter = new Hono<AppEnv>();

// Apply auth middleware
executionsRouter.use("*", authMiddleware);
executionsRouter.use("*", requireAuth);

executionsRouter.route("/", createRoute);
executionsRouter.route("/", listRoute);
executionsRouter.route("/", getRoute);
executionsRouter.route("/", cancelRoute);
executionsRouter.route("/", undoRoute);
executionsRouter.route("/", forceMergeRoute);
executionsRouter.route("/", streamRoute);
executionsRouter.route("/", agentsRoute);
executionsRouter.route("/", eventsRoute);

export default executionsRouter;
