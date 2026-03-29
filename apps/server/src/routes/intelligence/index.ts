// ** import core packages
import { Hono } from "hono";

// ** import routes
import chatRoute from "./chat";
import continuationRoute from "./continuation";
import projectsKnowledgeRoute from "./projects-knowledge";
import searchRoute from "./search";

// ** import types
import type { AppEnv } from "@/types";

const intelligenceRouter = new Hono<AppEnv>();

intelligenceRouter.route("/", chatRoute);
intelligenceRouter.route("/", continuationRoute);
intelligenceRouter.route("/", projectsKnowledgeRoute);
intelligenceRouter.route("/", searchRoute);

export default intelligenceRouter;
