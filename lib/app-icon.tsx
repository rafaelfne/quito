import { ImageResponse } from "next/og";
import { appIdentity } from "@/lib/app-identity";

export type AppIconSpec = { size: number; maskable: boolean };

export const homeScreenIcons = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const satisfies Record<string, AppIconSpec>;

export type HomeScreenIconName = keyof typeof homeScreenIcons;

export function isHomeScreenIconName(name: string): name is HomeScreenIconName {
  return Object.hasOwn(homeScreenIcons, name);
}

export function AppIcon({ size, maskable }: AppIconSpec) {
  const letterSize = Math.round(size * (maskable ? 0.5 : 0.62));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: appIdentity.brandColor,
        color: appIdentity.letterColor,
        fontSize: letterSize,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      Q
    </div>
  );
}

export function appIconImage(spec: AppIconSpec) {
  return new ImageResponse(<AppIcon {...spec} />, { width: spec.size, height: spec.size });
}
