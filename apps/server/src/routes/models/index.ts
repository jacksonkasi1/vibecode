// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import routes
import providersRoute from "./providers";
import listRoute from "./list";

// ** import types
import type { AppEnv } from "@/types";

const modelsRouter = new Hono<AppEnv>();

// Apply auth middleware to all routes
modelsRouter.use("*", authMiddleware);
modelsRouter.use("*", requireAuth);

modelsRouter.route("/", providersRoute);
modelsRouter.route("/", listRoute);

export default modelsRouter;
