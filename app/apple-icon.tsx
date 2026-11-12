import { appIconImage } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };

export const contentType = "image/png";

export default function AppleIcon() {
  return appIconImage({ size: size.width, maskable: false });
}
