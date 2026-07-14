import { resolveServerAssetUrl } from "../tilemap/serverAssets";
import type { PlayableMapTileMapProfile } from "../tilemap/tileMapTypes";

/**
 * Renders one baked plane (background or foreground) of a tile map as
 * absolutely-positioned chunk images. Chunks decode lazily, ignore pointer
 * events, and cost no layout/paint work beyond the browser's compositor, so
 * large Essentials maps stay cheap on mobile/webview targets.
 */
const TileMapSurface = ({
  tileMap,
  plane,
  zIndex,
}: {
  tileMap: PlayableMapTileMapProfile;
  plane: "background" | "foreground";
  zIndex: number;
}) => {
  const baked = tileMap.baked;

  if (!baked) {
    return null;
  }

  const chunks = plane === "background" ? baked.background : baked.foreground;

  if (chunks.length === 0) {
    return null;
  }

  const chunkPixels = baked.chunkCells * tileMap.tileSize;

  return (
    <>
      {chunks.map((chunk) => (
        <img
          key={`${plane}-${chunk.col}-${chunk.row}`}
          src={resolveServerAssetUrl(chunk.src)}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            left: `${chunk.col * chunkPixels}px`,
            top: `${chunk.row * chunkPixels}px`,
            width: `${chunk.width}px`,
            height: `${chunk.height}px`,
            imageRendering: "pixelated",
            pointerEvents: "none",
            userSelect: "none",
            zIndex,
          }}
        />
      ))}
    </>
  );
};

export default TileMapSurface;
