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

export function buildRssFeed(
  domain: string,
  feedUrl: string
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
      const itemUrl = `${feedUrl}#${n.id}`;
      const pubDate = formatRfc822Date(n.created_at);

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(itemUrl)}</link>
      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>
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
