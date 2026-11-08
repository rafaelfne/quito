import Link from "next/link";
import { notificationsGuidePath, notificationsInviteMessages } from "@/lib/notifications-invite";

export function NotificationsInvite({ text = notificationsInviteMessages.text }: { text?: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-sm border p-3" aria-labelledby="notifications-invite-title">
      <h2 className="font-medium" id="notifications-invite-title">
        {notificationsInviteMessages.title}
      </h2>
      <p className="text-sm">{text}</p>
      <Link className="flex min-h-11 items-center justify-center rounded-sm bg-foreground px-3 py-2 text-background" href={notificationsGuidePath}>
        {notificationsInviteMessages.action}
      </Link>
    </section>
  );
}
