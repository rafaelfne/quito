import { versionLabel } from "@/lib/version";

export function AppFooter() {
  return (
    <footer className="px-4 py-3 text-center text-xs text-muted-foreground">
      <p>{versionLabel()}</p>
    </footer>
  );
}
