// ** import types
import type { User, Session } from "@repo/db";

export type AppEnv = {
  Variables: {
    user: User | null;
    session: Session | null;
  };
};
