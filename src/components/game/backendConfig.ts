// The game server origin (socket + HTTP endpoints like /playable-maps.json)
// comes from public/config.json (backendUrl); App.tsx registers it here once
// at startup, mirroring how serverAssets.ts handles the asset-storage origin.

let backendBaseUrl = "";

export function setBackendBaseUrl(baseUrl: string) {
  backendBaseUrl = typeof baseUrl === "string" ? baseUrl.replace(/\/+$/, "") : "";
}

export function getBackendBaseUrl() {
  return backendBaseUrl;
}
