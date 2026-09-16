import { loadBundleForPages, ErrorNotice } from "@/lib/server-bundle";
import { buildPrescriptions } from "@/lib/prescriptions";

import { SimulatorClient } from "./simulator-client";

/**
 * Simulator page (ticket #19). Server side: load the bundle, hand the client
 * component the pinned simulator fragment and the prescriptions derived from
 * the segmentation fragment. All arithmetic happens at render time from the
 * bundle — nothing is hardcoded here.
 */
export default function SimulatorPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) {
    return <ErrorNotice message={loaded.message} />;
  }
  const frag = loaded.bundle.fragments.simulator;
  if (!frag) {
    return (
      <ErrorNotice message="The bundle has no simulator fragment — the market-mix simulator cannot run." />
    );
  }
  const prescriptions = buildPrescriptions(loaded.bundle.fragments.source_segmentation);

  return <SimulatorClient frag={frag} prescriptions={prescriptions} />;
}
