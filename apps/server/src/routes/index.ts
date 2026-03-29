// ** import core packages
import { Hono } from "hono";

// ** import routes
import authRouter from "./auth";
import storageRouter from "./storage";
import projectsRouter from "./projects";
import workspacesRouter from "./workspaces";
import executionsRouter from "./executions";
import modelsRouter from "./models";
import artifactsRouter from "./artifacts";
import threadsRouter from "./threads";
import agentsRouter from "./agents";
import envRouter from "./env";
import intelligenceRouter from "./intelligence";

const apiRouter = new Hono();

apiRouter.route("/auth", authRouter);
apiRouter.route("/storage", storageRouter);
apiRouter.route("/projects", projectsRouter);
apiRouter.route("/workspaces", workspacesRouter);
apiRouter.route("/executions", executionsRouter);
apiRouter.route("/models", modelsRouter);
apiRouter.route("/artifacts", artifactsRouter);
apiRouter.route("/threads", threadsRouter);
apiRouter.route("/agents", agentsRouter);
apiRouter.route("/env", envRouter);
apiRouter.route("/intelligence", intelligenceRouter);

export default apiRouter;
