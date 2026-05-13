/** A delivery channel for notifications (RSS, VK, email, etc.) */
export interface Channel {
  readonly name: string;

  /** Called when a new notification arrives for a project */
  onNotification(project: { id: number; domain: string; uuid: string }, payload: string): void | Promise<void>;
}
