import { Elysia } from "elysia";
import { ADMIN_SECRET, generateToken, generateUuid, BASE_URL } from "../config";
import { stmt, isDomainValid } from "../db";

export const registerRoute = new Elysia().post("/register", ({ body, set }) => {
  const { secret, domain } = body as { secret: string; domain: string };

  if (secret !== ADMIN_SECRET) {
    set.status = 401;
    return { error: "Invalid secret" };
  }

  if (!domain || !isDomainValid(domain)) {
    set.status = 400;
    return { error: "Invalid domain" };
  }

  const existing = stmt.getProjectByDomain.get(domain) as any;
  if (existing) {
    set.status = 409;
    return { error: "Domain already registered" };
  }

  const uuid = generateUuid();
  const verifyToken = generateToken();

  stmt.insertProject.run(uuid, domain, verifyToken);

  return {
    uuid,
    feedUrl: `${BASE_URL}/feed/${uuid}`,
    verifyToken,
  };
});
