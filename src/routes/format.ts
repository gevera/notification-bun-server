import { Elysia } from "elysia";
import { stmt } from "../db";
import { ADMIN_SECRET } from "../config";
import { sanitizeFormatConfig } from "../format";

export const formatRoute = new Elysia().put(
  "/format/:uuid",
  ({ params, body, request, set }) => {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${ADMIN_SECRET}`) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const project = stmt.getProjectByUuid.get(params.uuid) as any;
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }

    const parsed = typeof body === "object" ? body : JSON.parse(String(body));
    const config = sanitizeFormatConfig(parsed);
    if (!config) {
      set.status = 400;
      return { error: "Invalid format_config" };
    }

    stmt.updateFormatConfig.run(JSON.stringify(config), project.id);
    return { status: "ok" };
  }
);
