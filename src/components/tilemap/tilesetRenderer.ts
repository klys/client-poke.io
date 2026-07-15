import { AUTOTILE_PATTERNS } from "./autotile";
import { resolveServerAssetUrl } from "./serverAssets";
import {
  AUTOTILE_ID_UNIT,
  AUTOTILE_SLOTS,
  DesignerTilesetProfile,
  FIRST_TILESET_TILE_ID,
  TILESET_COLUMNS,
  TILE_SIZE,
} from "./tileMapTypes";

export function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    // Tileset/autotile sources may be data URIs or root-relative asset-storage
    // paths; resolve so remote images load off the asset-storage origin.
    image.src = resolveServerAssetUrl(src);
  });
}

/**
 * Draws individual RMXP tile ids (autotile compositions and tileset tiles)
 * onto canvas contexts. Rendering matches the migration tool's MapRenderer:
 * autotiles compose four 16x16 quarters from frame 0 of the 96x128 autotile
 * image; single-row strips use their first 32x32 frame.
 */
export class TilesetRenderer {
  readonly profile: DesignerTilesetProfile;
  private readonly tilesetImage: HTMLImageElement | null;
  private readonly autotileImages: Array<HTMLImageElement | null>;

  private constructor(
    profile: DesignerTilesetProfile,
    tilesetImage: HTMLImageElement | null,
    autotileImages: Array<HTMLImageElement | null>
  ) {
    this.profile = profile;
    this.tilesetImage = tilesetImage;
    this.autotileImages = autotileImages;
  }

  static async create(profile: DesignerTilesetProfile) {
    const [tilesetImage, ...autotileImages] = await Promise.all([
      loadImageElement(profile.tilesetImageSrc),
      ...Array.from({ length: AUTOTILE_SLOTS }, (_, slot) =>
        loadImageElement(profile.autotiles[slot]?.imageSrc ?? "")
      ),
    ]);

    return new TilesetRenderer(profile, tilesetImage, autotileImages);
  }

  tilesetTileCount() {
    if (!this.tilesetImage) {
      return this.profile.tilesetHeightTiles * TILESET_COLUMNS;
    }

    return Math.floor(this.tilesetImage.height / TILE_SIZE) * TILESET_COLUMNS;
  }

  drawTile(context: CanvasRenderingContext2D, tileId: number, dx: number, dy: number) {
    if (tileId < AUTOTILE_ID_UNIT) {
      return;
    }

    if (tileId < FIRST_TILESET_TILE_ID) {
      this.drawAutotile(context, tileId, dx, dy);
      return;
    }

    if (!this.tilesetImage) {
      return;
    }

    const index = tileId - FIRST_TILESET_TILE_ID;
    const sourceX = (index % TILESET_COLUMNS) * TILE_SIZE;
    const sourceY = Math.floor(index / TILESET_COLUMNS) * TILE_SIZE;

    if (sourceY + TILE_SIZE > this.tilesetImage.height) {
      return;
    }

    context.drawImage(
      this.tilesetImage,
      sourceX,
      sourceY,
      TILE_SIZE,
      TILE_SIZE,
      dx,
      dy,
      TILE_SIZE,
      TILE_SIZE
    );
  }

  private drawAutotile(
    context: CanvasRenderingContext2D,
    tileId: number,
    dx: number,
    dy: number
  ) {
    const slot = Math.floor(tileId / AUTOTILE_ID_UNIT) - 1;
    const variant = tileId % AUTOTILE_ID_UNIT;
    const source = this.autotileImages[slot];

    if (!source) {
      return;
    }

    if (source.height <= TILE_SIZE) {
      // Single-row animation strip: use the first 32x32 frame.
      context.drawImage(
        source,
        0,
        0,
        Math.min(TILE_SIZE, source.width),
        source.height,
        dx,
        dy,
        Math.min(TILE_SIZE, source.width),
        source.height
      );
      return;
    }

    const pattern = AUTOTILE_PATTERNS[variant];

    for (let corner = 0; corner < 4; corner += 1) {
      const piece = pattern[corner] - 1;
      const sourceX = (piece % 6) * 16;
      const sourceY = Math.floor(piece / 6) * 16;

      context.drawImage(
        source,
        sourceX,
        sourceY,
        16,
        16,
        dx + (corner % 2) * 16,
        dy + Math.floor(corner / 2) * 16,
        16,
        16
      );
    }
  }
}
