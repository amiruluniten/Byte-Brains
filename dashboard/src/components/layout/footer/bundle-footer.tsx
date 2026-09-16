import { APP_CONFIG } from "@/config/app-config";
import type { Bundle } from "@/lib/bundle";

/**
 * The footer contract (ticket #15/#17): bundle version + full checksum,
 * matching report-pack/pinned-bundle.md exactly. Shared by every page so the
 * contract cannot drift between routes.
 */
export function BundleFooter({ bundle }: { bundle: Bundle }) {
  return (
    <footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
      <span>{APP_CONFIG.copyright}</span>
      <span>
        Data bundle v{bundle.bundle_version} &middot; schema {bundle.schema_version} &middot; sha256{" "}
        <code className="break-all">{bundle.checksum}</code> &middot; generated{" "}
        {bundle.generated_utc}
      </span>
    </footer>
  );
}
