// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import createRoute from "./create";
import listRoute from "./list";
import getRoute from "./get";
import cancelRoute from "./cancel";
import streamRoute from "./stream";

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
executionsRouter.route("/", streamRoute);

export default executionsRouter;
