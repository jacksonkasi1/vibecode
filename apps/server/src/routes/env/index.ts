// ** import core packages
import { Hono } from "hono";

// ** import routes
import envVarsRoute from "./env-vars";
import secretsRoute from "./secrets";

// ** import types
import type { AppEnv } from "@/types";

const envRouter = new Hono<AppEnv>();

envRouter.route("/", envVarsRoute);
envRouter.route("/", secretsRoute);

export default envRouter;
