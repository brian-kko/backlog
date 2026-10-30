import { authRouter } from "./router/auth";
import { backlogRouter } from "./router/backlog";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  backlog: backlogRouter,
  post: postRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
