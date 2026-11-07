import type { MetadataRoute } from "next";
import { homeScreenIcons } from "@/lib/app-icon";
import { appIdentity } from "@/lib/app-identity";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: appIdentity.name,
    short_name: appIdentity.name,
    description: appIdentity.description,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: appIdentity.lightBackground,
    theme_color: appIdentity.lightBackground,
    icons: Object.entries(homeScreenIcons).map(([name, { size, maskable }]) => ({
      src: `/icons/${name}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: maskable ? "maskable" : "any",
    })),
  };
}
