import { encode } from "uqr";
import { notificationsGuidePath } from "@/lib/notifications-invite";

export const qrQuietZone = 4;

export type QrCode = { size: number; path: string };

export function guideLinkFrom(origin: string): string {
  return `${origin}${notificationsGuidePath}`;
}

export function qrCodeOf(text: string): QrCode {
  const { data } = encode(text, { ecc: "M", border: 0 });
  const squares = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x + qrQuietZone} ${y + qrQuietZone}h1v1h-1z`] : [])));
  return { size: data.length + qrQuietZone * 2, path: squares.join("") };
}
