import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { logger } from "elysia-logger";
import { PORT, RATE_LIMIT_MAX, RATE_LIMIT_DURATION_MS } from "./config";
import { registerRoute } from "./routes/register";
import { verifyRoute } from "./routes/verify";
import { notifyRoute } from "./routes/notify";
import { feedRoute } from "./routes/feed";
import { formatRoute } from "./routes/format";

const app = new Elysia()
  .use(cors())
  .use(
    rateLimit({
      max: RATE_LIMIT_MAX,
      duration: RATE_LIMIT_DURATION_MS,
    })
  )
  .use(
    logger({
      autoLogging: true,
      logRequestStart: false,
      logDetails: true,
    })
  )
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const origin =
      request.headers.get("origin") ?? request.headers.get("referer") ?? "-";
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${url.pathname} ip=${ip} origin=${origin}`,
    );
  })
  .use(registerRoute)
  .use(verifyRoute)
  .use(notifyRoute)
  .use(feedRoute)
  .use(formatRoute)
  .listen(PORT);

console.log(`Notification relay running on port ${PORT}`);
