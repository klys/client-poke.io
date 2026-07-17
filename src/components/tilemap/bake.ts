import { TilesetRenderer } from "./tilesetRenderer";
import {
  DEFAULT_BAKE_CHUNK_CELLS,
  DesignerTilesetProfile,
  priorityForTileId,
  TILE_SIZE,
} from "./tileMapTypes";

export interface BakedChunkImage {
  col: number;
  row: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface BakedTileMapImages {
  chunkCells: number;
  background: BakedChunkImage[];
  foreground: BakedChunkImage[];
}

function createChunkCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (context) {
    context.imageSmoothingEnabled = false;
  }

  return { canvas, context };
}

/**
 * Bakes the three tile layers into static PNG chunks: priority-0 tiles land
 * on the background plane (below players), priority>=1 tiles on the
 * foreground plane (above players). Chunks that stay fully transparent are
 * skipped, so sparse foregrounds cost nothing at runtime.
 */
export async function bakeTileMapChunks(
  layers: Uint16Array[],
  width: number,
  height: number,
  profile: DesignerTilesetProfile,
  chunkCells: number = DEFAULT_BAKE_CHUNK_CELLS
): Promise<BakedTileMapImages> {
  const renderer = await TilesetRenderer.create(profile);
  const background: BakedChunkImage[] = [];
  const foreground: BakedChunkImage[] = [];
  const chunkColumns = Math.ceil(width / chunkCells);
  const chunkRows = Math.ceil(height / chunkCells);

  for (let chunkRow = 0; chunkRow < chunkRows; chunkRow += 1) {
    // Baking a large map is seconds of canvas work; yield between chunk rows
    // so the save spinner keeps animating and input isn't frozen.
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (let chunkColumn = 0; chunkColumn < chunkColumns; chunkColumn += 1) {
      const cellLeft = chunkColumn * chunkCells;
      const cellTop = chunkRow * chunkCells;
      const cellWidth = Math.min(chunkCells, width - cellLeft);
      const cellHeight = Math.min(chunkCells, height - cellTop);
      const pixelWidth = cellWidth * TILE_SIZE;
      const pixelHeight = cellHeight * TILE_SIZE;

      const backgroundChunk = createChunkCanvas(pixelWidth, pixelHeight);
      const foregroundChunk = createChunkCanvas(pixelWidth, pixelHeight);

      if (!backgroundChunk.context || !foregroundChunk.context) {
        throw new Error("Unable to create canvas contexts for map baking.");
      }

      let drewBackground = false;
      let drewForeground = false;

      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < cellWidth; x += 1) {
          const cellIndex = (cellTop + y) * width + (cellLeft + x);

          for (let z = 0; z < layers.length; z += 1) {
            const tileId = layers[z][cellIndex];

            if (tileId === 0) {
              continue;
            }

            const isForeground = priorityForTileId(profile, tileId) > 0;
            const target = isForeground ? foregroundChunk.context : backgroundChunk.context;

            renderer.drawTile(target, tileId, x * TILE_SIZE, y * TILE_SIZE);

            if (isForeground) {
              drewForeground = true;
            } else {
              drewBackground = true;
            }
          }
        }
      }

      if (drewBackground) {
        background.push({
          col: chunkColumn,
          row: chunkRow,
          width: pixelWidth,
          height: pixelHeight,
          dataUrl: backgroundChunk.canvas.toDataURL("image/png"),
        });
      }

      if (drewForeground) {
        foreground.push({
          col: chunkColumn,
          row: chunkRow,
          width: pixelWidth,
          height: pixelHeight,
          dataUrl: foregroundChunk.canvas.toDataURL("image/png"),
        });
      }
    }
  }

  return { chunkCells, background, foreground };
}
