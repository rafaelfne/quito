import packageJson from "@/package.json";

export const appVersion: string = packageJson.version;

export function versionLabel(version: string = appVersion) {
  return `Quitô versão ${version}`;
}
