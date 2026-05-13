import { Elysia } from "elysia";
import { stmt } from "../db";
import { channels } from "../channels";

export const notifyRoute = new Elysia().post("/notify", async ({ request, body, set }) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    set.status = 400;
    return { error: "Missing Origin header" };
  }

  let domain: string;
  try {
    domain = new URL(origin).hostname;
  } catch {
    set.status = 400;
    return { error: "Invalid Origin" };
  }

  const project = stmt.getProjectByDomain.get(domain) as any;
  if (!project) {
    set.status = 404;
    return { error: "Domain not registered" };
  }

  if (!project.verified) {
    set.status = 403;
    return { error: "Domain not verified" };
  }

  const payload = typeof body === "string" ? body : JSON.stringify(body);
  stmt.insertNotification.run(project.id, payload);

  for (const channel of channels) {
    try {
      await channel.onNotification(
        { id: project.id, domain: project.domain, uuid: project.uuid },
        payload
      );
    } catch (err) {
      console.error(`Channel "${channel.name}" error:`, err);
    }
  }

  set.status = 201;
  return { status: "ok" };
});
