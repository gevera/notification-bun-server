import type { Channel } from "./types";
import { stmt } from "../db";
import { BASE_URL, MAX_FEED_ITEMS, escapeXml } from "../config";

export const rssChannel: Channel = {
  name: "rss",

  onNotification() {
    // RSS is pull-based — we just store to DB (already done before calling channels).
    // The feed is generated on-demand in GET /feed/:uuid.
  },
};

export function buildRssFeed(
  domain: string,
  feedUrl: string
): string {
  const project = stmt.getProjectByDomain.get(domain) as any;
  if (!project) return "";

  const notifications = stmt.getNotifications.all(
    project.id,
    MAX_FEED_ITEMS
  ) as { payload: string; created_at: string }[];

  const items = notifications
    .map(
      (n) => `
    <item>
      <title>Notification</title>
      <description>${escapeXml(n.payload)}</description>
      <pubDate>${new Date(n.created_at + "Z").toUTCString()}</pubDate>
    </item>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Notifications for ${escapeXml(domain)}</title>
    <description>Website notification feed</description>
    <link>${escapeXml(feedUrl)}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;
}

export function makeFeedUrl(uuid: string): string {
  return `${BASE_URL}/feed/${uuid}`;
}
