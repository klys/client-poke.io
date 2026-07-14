// Game assets (baked map chunks, migration exports, sprites, audio) live on
// the standalone asset-storage nginx server and are referenced by
// root-relative paths ("/map-assets/<mapId>/<file>",
// "/migration_exports/audio/..."). The asset server origin comes from
// public/config.json (assetStorageBaseUrl), so App.tsx registers it here once
// at startup. When unset, paths resolve against the frontend origin, which
// preserves the old bundled-assets behavior.

let assetStorageBaseUrl = "";

export function setAssetStorageBaseUrl(baseUrl: string) {
  assetStorageBaseUrl = typeof baseUrl === "string" ? baseUrl.replace(/\/+$/, "") : "";
}

// Prefix a root-relative asset path with the asset-storage origin. Absolute
// URLs and data URIs pass through untouched, so designer-entered values keep
// working.
export function assetUrl(path: string) {
  if (!path || !path.startsWith("/")) {
    return path;
  }

  return `${assetStorageBaseUrl}${path}`;
}

// Historical name kept for the map/battle/audio call sites; asset references
// coming out of server snapshots and designer profiles are all root-relative
// asset paths, so this is the same resolution as assetUrl.
export function resolveServerAssetUrl(src: string) {
  return assetUrl(src);
}
