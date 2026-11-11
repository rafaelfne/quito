import Link from "next/link";
import type { NotificationsLoss } from "@/lib/activation-guide";
import { notificationsAlertMessages, notificationsGuidePath, notificationsInviteMessages } from "@/lib/notifications-invite";

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

const lossText: Record<NotificationsLoss, string> = {
  lost: notificationsAlertMessages.lostText,
  blocked: notificationsAlertMessages.blockedText,
};

export function NotificationsAlert({ loss }: { loss: NotificationsLoss }) {
  return (
    <section className="flex flex-col gap-2 rounded-sm border border-destructive bg-destructive/10 p-3" role="alert" aria-labelledby="notifications-alert-title">
      <h2 className="font-medium" id="notifications-alert-title">
        {notificationsAlertMessages.title}
      </h2>
      <p className="text-sm">{lossText[loss]}</p>
      <p className="text-sm">{notificationsAlertMessages.fallbackText}</p>
      <Link className="flex min-h-11 items-center justify-center rounded-sm bg-foreground px-3 py-2 text-background" href={notificationsGuidePath}>
        {notificationsAlertMessages.action}
      </Link>
    </section>
  );
}
