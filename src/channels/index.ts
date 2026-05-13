import type { Channel } from "./types";
import { rssChannel } from "./rss";

/** Active delivery channels — add new ones here (VK, email, etc.) */
export const channels: Channel[] = [rssChannel];

export { rssChannel, buildRssFeed, makeFeedUrl } from "./rss";
export type { Channel } from "./types";
