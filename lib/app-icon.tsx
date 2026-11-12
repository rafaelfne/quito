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

const fullViewBox = "0 0 512 512";
const maskableSafeZoneViewBox = "-64 -64 640 640";

export function AppIcon({ size, maskable }: AppIconSpec) {
  return (
    <div style={{ width: size, height: size, display: "flex", background: appIdentity.brandColor }}>
      <svg width={size} height={size} viewBox={maskable ? maskableSafeZoneViewBox : fullViewBox}>
        <circle cx="246" cy="246" r="124" fill="none" stroke={appIdentity.letterColor} strokeWidth="56" />
        <path d="M300 300 L388 388" stroke={appIdentity.accentColor} strokeWidth="56" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function appIconImage(spec: AppIconSpec) {
  return new ImageResponse(<AppIcon {...spec} />, { width: spec.size, height: spec.size });
}
