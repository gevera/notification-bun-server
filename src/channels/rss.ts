import type { Channel } from "./types";
import { stmt } from "../db";
import {
  BASE_URL,
  MAX_FEED_ITEMS,
  escapeXml,
  formatRfc822Date,
} from "../config";
import { formatNotification } from "../format";

export const rssChannel: Channel = {
  name: "rss",

  onNotification() {
    // RSS is pull-based — we just store to DB (already done before calling channels).
    // The feed is generated on-demand in GET /feed/:uuid.
  },
};

type NotificationRow = {
  id: number;
  payload: string;
  created_at: string;
};

/** Wrap text in CDATA, splitting sections if the payload contains ]]> */
function wrapCdata(text: string): string {
  if (!text.includes("]]>")) {
    return `<![CDATA[${text}]]>`;
  }
  return text
    .split("]]>")
    .map((part) => `<![CDATA[${part}]]>`)
    .join("]]>");
}

export function makeItemUrl(uuid: string, notificationId: number): string {
  return `${BASE_URL}/feed/${uuid}/${notificationId}`;
}

export function buildNotificationHtmlPage(
  domain: string,
  title: string,
  descriptionPlain: string
): string {
  const bodyHtml = escapeXml(descriptionPlain).replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=yes">
  <title>${escapeXml(title)}</title>
</head>
<body>
  <article>
    <p class="source">${escapeXml(domain)}</p>
    <h1>${escapeXml(title)}</h1>
    <div class="content">${bodyHtml}</div>
  </article>
</body>
</html>`;
}

export function buildRssFeed(
  domain: string,
  feedUrl: string,
  projectUuid: string
): string {
  const project = stmt.getProjectByDomain.get(domain) as any;
  if (!project) return "";

  const formatConfig = project.format_config
    ? JSON.parse(project.format_config)
    : null;

  const notifications = stmt.getNotifications.all(
    project.id,
    MAX_FEED_ITEMS
  ) as NotificationRow[];

  const items = notifications
    .map((n) => {
      const { title, descriptionPlain, descriptionHtml } = formatNotification(
        n.payload,
        n.created_at,
        formatConfig
      );
      const itemUrl = makeItemUrl(projectUuid, n.id);
      const guid = `${feedUrl}#${n.id}`;
      const pubDate = formatRfc822Date(n.created_at);

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(itemUrl)}</link>
      <guid isPermaLink="true">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(descriptionPlain)}</description>
      <content:encoded>${wrapCdata(descriptionHtml)}</content:encoded>
    </item>`;
    })
    .join("");

  const lastBuild = formatRfc822Date(
    notifications[0]?.created_at ?? new Date().toISOString()
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Notifications for ${escapeXml(domain)}</title>
    <description>Website notification feed</description>
    <link>${escapeXml(feedUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuild}</lastBuildDate>${items}
  </channel>
</rss>`;
}

export function makeFeedUrl(uuid: string): string {
  return `${BASE_URL}/feed/${uuid}`;
}
