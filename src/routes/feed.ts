import { Elysia, t } from "elysia";
import { stmt } from "../db";
import { MAX_FEED_ITEMS } from "../config";
import {
  buildNotificationHtmlPage,
  buildRssFeed,
  makeFeedUrl,
} from "../channels/rss";
import { formatNotification } from "../format";

export const feedRoute = new Elysia()
  .get(
    "/feed/:uuid/:id",
    ({ params, set }) => {
      const notificationId = Number(params.id);
      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        set.status = 404;
        return "Not found";
      }

      const project = stmt.getProjectByUuid.get(params.uuid) as any;
      if (!project) {
        set.status = 404;
        return "Not found";
      }

      const notifications = stmt.getNotifications.all(
        project.id,
        MAX_FEED_ITEMS
      ) as Array<{ id: number; payload: string; created_at: string }>;
      const row = notifications.find((n) => n.id === notificationId);
      if (!row) {
        set.status = 404;
        return "Not found";
      }

      const formatConfig = project.format_config
        ? JSON.parse(project.format_config)
        : null;
      const { title, descriptionHtml } = formatNotification(
        row.payload,
        row.created_at,
        formatConfig
      );

      set.headers["content-type"] = "text/html; charset=utf-8";
      return buildNotificationHtmlPage(project.domain, title, descriptionHtml);
    },
    {
      params: t.Object({
        uuid: t.String(),
        id: t.String(),
      }),
    }
  )
  .get("/feed/:uuid", ({ params, set }) => {
    const project = stmt.getProjectByUuid.get(params.uuid) as any;
    if (!project) {
      set.status = 404;
      return "Not found";
    }

    const feedUrl = makeFeedUrl(params.uuid);
    set.headers["content-type"] = "application/rss+xml; charset=utf-8";
    return buildRssFeed(project.domain, feedUrl, params.uuid);
  });
