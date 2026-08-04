"use client";

import dynamic from "next/dynamic";
import type { MapCluster } from "@workspace/api-client-react";
import type { MapViewport } from "../lib/map-contract";
import { searchConfig } from "../lib/search-config";
import { searchUiCopy } from "../lib/search-ui-copy";
import { useSearchLocale } from "../lib/use-search-locale";
import { SearchMapClusterCanvas } from "./SearchMapClusterCanvas";

function MapLoadingFallback() {
  const locale = useSearchLocale();
  const copy = searchUiCopy(locale);
  return (
    <p style={{ marginTop: "0.75rem", color: "var(--banco-muted)" }}>{copy.mapLoadingSurface}</p>
  );
}

const SearchGoogleMap = dynamic(
  () => import("./SearchGoogleMap").then((module) => module.SearchGoogleMap),
  {
    ssr: false,
    loading: () => <MapLoadingFallback />,
  },
);

type SearchMapSurfaceProps = {
  clusters: MapCluster[];
  viewport: MapViewport;
  totalListings: number;
  onViewportChange?: (viewport: MapViewport) => void;
  compact?: boolean;
};

/**
 * Warn once per page load when the map was deliberately switched on but has no
 * key to draw itself with.
 *
 * The degrade below is otherwise completely silent, and silent is the problem:
 * SearchMapClusterCanvas has no pan, no zoom, no click — not one pointer
 * handler — and it carries no label saying it is a reduced view. So an operator
 * who sets NEXT_PUBLIC_WEB_SEARCH_MAP=true and forgets the key gets a picture
 * of a map that looks deployed and works for nobody, with nothing in the logs.
 *
 * Only this exact pair is worth a warning. A missing key while the map flag is
 * off is the documented default (the flag ships false), and warning there would
 * train people to ignore the message.
 */
let warnedAboutMissingKey = false;

function warnIfMapEnabledWithoutKey(hasGoogleKey: boolean) {
  if (warnedAboutMissingKey) return;
  if (!searchConfig.map.enabled || hasGoogleKey) return;
  warnedAboutMissingKey = true;
  console.warn(
    "[search-map] NEXT_PUBLIC_WEB_SEARCH_MAP is true but " +
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is empty. Falling back to the static " +
      "cluster canvas: no pan, no zoom, no interaction. Set the key (see " +
      "artifacts/banco-website/.env.example) to restore the interactive map.",
  );
}

export function SearchMapSurface({
  clusters,
  viewport,
  totalListings,
  onViewportChange,
  compact = false,
}: SearchMapSurfaceProps) {
  const hasGoogleKey = searchConfig.map.googleMapsApiKey.length > 0;
  warnIfMapEnabledWithoutKey(hasGoogleKey);
  if (hasGoogleKey && onViewportChange) {
    return (
      <SearchGoogleMap
        clusters={clusters}
        viewport={viewport}
        totalListings={totalListings}
        onViewportChange={onViewportChange}
        compact={compact}
      />
    );
  }

  return (
    <SearchMapClusterCanvas
      clusters={clusters}
      viewport={viewport}
      totalListings={totalListings}
      compact={compact}
    />
  );
}
