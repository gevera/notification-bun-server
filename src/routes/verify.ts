import { Elysia } from "elysia";
import { stmt } from "../db";

export const verifyRoute = new Elysia().post("/verify/:uuid", async ({ params, set }) => {
  const project = stmt.getProjectByUuid.get(params.uuid) as any;
  if (!project) {
    set.status = 404;
    return { error: "Project not found" };
  }

  if (project.verified) {
    return { status: "already_verified" };
  }

  const url = `https://${project.domain}/.well-known/verify.txt`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).trim();
    if (text !== project.verify_token) {
      set.status = 400;
      return { error: "Token mismatch" };
    }
  } catch {
    set.status = 400;
    return { error: "Could not fetch verify.txt from domain" };
  }

  stmt.verifyProject.run(project.id);
  return { status: "verified" };
});
