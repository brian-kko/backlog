import { authRouter } from "./router/auth";
import { backlogRouter } from "./router/backlog";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  backlog: backlogRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
