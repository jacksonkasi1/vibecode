// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import listRoute from "./list";
import renameRoute from "./rename";
import deleteRoute from "./delete";
import restoreRoute from "./restore";

// ** import types
import type { AppEnv } from "@/types";

const threadsRouter = new Hono<AppEnv>();

// Apply auth middleware
threadsRouter.use("*", authMiddleware);
threadsRouter.use("*", requireAuth);

threadsRouter.route("/", listRoute);
threadsRouter.route("/", renameRoute);
threadsRouter.route("/", deleteRoute);
threadsRouter.route("/", restoreRoute);

export default threadsRouter;
