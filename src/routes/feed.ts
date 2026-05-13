import { Elysia } from "elysia";
import { stmt } from "../db";
import { buildRssFeed, makeFeedUrl } from "../channels/rss";

export const feedRoute = new Elysia().get("/feed/:uuid", ({ params, set }) => {
  const project = stmt.getProjectByUuid.get(params.uuid) as any;
  if (!project) {
    set.status = 404;
    return "Not found";
  }

  const feedUrl = makeFeedUrl(params.uuid);
  set.headers["Content-Type"] = "application/rss+xml; charset=utf-8";
  return buildRssFeed(project.domain, feedUrl);
});
