// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import listRoute from "./list";
import getRoute from "./get";

// ** import types
import type { AppEnv } from "@/types";

const artifactsRouter = new Hono<AppEnv>();

// Apply auth middleware to all routes
artifactsRouter.use("*", authMiddleware);
artifactsRouter.use("*", requireAuth);

artifactsRouter.route("/", listRoute);
artifactsRouter.route("/", getRoute);

export default artifactsRouter;
