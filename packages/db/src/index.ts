export * from "./schema";
export * from "./execution-events";
export * from "drizzle-orm";
export { createClient, type DbInstance } from "./client";
export { type Env, createEnvFromProcessEnv } from "./types";

// ** import client
import { createClient } from "./client";

export const db = createClient();
