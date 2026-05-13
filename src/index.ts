import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
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
  .use(registerRoute)
  .use(verifyRoute)
  .use(notifyRoute)
  .use(feedRoute)
  .use(formatRoute)
  .listen(PORT);

console.log(`Notification relay running on port ${PORT}`);
