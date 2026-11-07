import { appIconImage, homeScreenIcons, isHomeScreenIconName } from "@/lib/app-icon";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(homeScreenIcons).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isHomeScreenIconName(name)) return new Response(null, { status: 404 });
  return appIconImage(homeScreenIcons[name]);
}
