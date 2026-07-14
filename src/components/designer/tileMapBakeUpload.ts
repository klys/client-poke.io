import { bakeTileMapChunks } from "../tilemap/bake";
import { decodeTileMapLayers } from "../tilemap/tileMapProfile";
import type {
  DesignerTilesetProfile,
  PlayableMapBakedChunk,
  PlayableMapTileMapProfile,
} from "../tilemap/tileMapTypes";
import { readStoredDesignerSectionPayload } from "./designerCache";

const UPLOAD_TIMEOUT_MS = 15000;

interface MapAssetUploadResult {
  mapId: string;
  files: Array<{ name: string; path: string }>;
}

function uploadMapAssets(
  socket: any,
  mapId: string,
  files: Array<{ name: string; dataUrl: string }>
): Promise<MapAssetUploadResult> {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error("Socket is not connected."));
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out uploading baked map assets."));
    }, UPLOAD_TIMEOUT_MS);

    const handleState = (payload: MapAssetUploadResult) => {
      if (payload?.mapId !== mapId) {
        return;
      }

      cleanup();
      resolve(payload);
    };

    const handleError = ({ message }: { message: string }) => {
      cleanup();
      reject(new Error(message));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.off("designer:mapAssets:state", handleState);
      socket.off("playableMaps:error", handleError);
    };

    socket.on("designer:mapAssets:state", handleState);
    socket.on("playableMaps:error", handleError);
    socket.emit("designer:mapAssets:update", { mapId, files, replace: true });
  });
}

/**
 * Re-bakes a tile map's background/foreground chunks and uploads them to the
 * server asset store. Falls back to embedding the chunk PNGs as data URLs
 * when the upload is unavailable, so saving still works offline.
 */
export async function bakeTileMapForSave(
  mapId: string,
  tileMap: PlayableMapTileMapProfile,
  socket: any
): Promise<{ tileMap: PlayableMapTileMapProfile; uploaded: boolean }> {
  const tilesetItem = readStoredDesignerSectionPayload("tilesets").state.items.find(
    (item) => item.id === tileMap.tilesetItemId
  );
  const tilesetProfile = tilesetItem?.tilesetProfile as DesignerTilesetProfile | undefined;

  if (!tilesetProfile) {
    throw new Error(`Tileset "${tileMap.tilesetItemId}" was not found in the tilesets section.`);
  }

  const layers = decodeTileMapLayers(tileMap);

  if (!layers) {
    throw new Error("Tile layers could not be decoded.");
  }

  const baked = await bakeTileMapChunks(layers, tileMap.width, tileMap.height, tilesetProfile);
  const chunkName = (plane: "bg" | "fg", chunk: { col: number; row: number }) =>
    `${plane}-${chunk.col}-${chunk.row}.png`;
  const files = [
    ...baked.background.map((chunk) => ({ name: chunkName("bg", chunk), dataUrl: chunk.dataUrl })),
    ...baked.foreground.map((chunk) => ({ name: chunkName("fg", chunk), dataUrl: chunk.dataUrl })),
  ];

  let pathByName: Record<string, string> | null = null;
  let uploaded = false;

  if (files.length > 0) {
    try {
      const result = await uploadMapAssets(socket, mapId, files);

      pathByName = result.files.reduce<Record<string, string>>((accumulator, file) => {
        accumulator[file.name] = file.path;
        return accumulator;
      }, {});
      uploaded = true;
    } catch (error) {
      console.warn("Falling back to embedded baked chunks:", error);
    }
  }

  const toChunkRefs = (
    plane: "bg" | "fg",
    chunks: typeof baked.background
  ): PlayableMapBakedChunk[] =>
    chunks.map((chunk) => ({
      col: chunk.col,
      row: chunk.row,
      width: chunk.width,
      height: chunk.height,
      src: pathByName?.[chunkName(plane, chunk)] ?? chunk.dataUrl,
    }));

  return {
    uploaded,
    tileMap: {
      ...tileMap,
      baked: {
        chunkCells: baked.chunkCells,
        background: toChunkRefs("bg", baked.background),
        foreground: toChunkRefs("fg", baked.foreground),
        bakedAt: new Date().toISOString(),
      },
    },
  };
}
