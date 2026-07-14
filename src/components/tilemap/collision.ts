import {
  DesignerTilesetProfile,
  PASSAGE_BUSH,
  PASSAGE_COUNTER,
  PASSAGE_SOLID_MASK,
  PASSAGE_STAR,
  passageForTileId,
  priorityForTileId,
  terrainTagForTileId,
} from "./tileMapTypes";

const DIRECTION_BITS = [0x01, 0x02, 0x04, 0x08]; // down, left, right, up

/**
 * Derives the per-cell collision byte grid from the three tile layers,
 * mirroring RPG Maker XP's Game_Map#passable?: walk layers top to bottom,
 * skip empty tiles and star (through) tiles; the first remaining tile decides
 * each direction — its blocked bit wins, otherwise priority 0 means passable.
 * Bush (0x40) and counter (0x80) flags of the deciding top tile are carried.
 */
export function deriveCollisionGrid(
  layers: Uint16Array[],
  width: number,
  height: number,
  profile: DesignerTilesetProfile
): Uint8Array {
  const cells = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    let cellByte = 0;

    for (const directionBit of DIRECTION_BITS) {
      for (let z = layers.length - 1; z >= 0; z -= 1) {
        const tileId = layers[z][index];

        if (tileId === 0) {
          continue;
        }

        const passage = passageForTileId(profile, tileId);

        if (passage & PASSAGE_STAR) {
          continue;
        }

        if (passage & directionBit) {
          cellByte |= directionBit;
          break;
        }

        if (priorityForTileId(profile, tileId) === 0) {
          break;
        }
      }
    }

    for (let z = layers.length - 1; z >= 0; z -= 1) {
      const tileId = layers[z][index];

      if (tileId === 0) {
        continue;
      }

      const passage = passageForTileId(profile, tileId);

      if (passage & PASSAGE_STAR) {
        continue;
      }

      cellByte |= passage & (PASSAGE_BUSH | PASSAGE_COUNTER);
      break;
    }

    cells[index] = cellByte;
  }

  return cells;
}

export function deriveTerrainTagGrid(
  layers: Uint16Array[],
  width: number,
  height: number,
  profile: DesignerTilesetProfile
): Uint8Array {
  const cells = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    for (let z = layers.length - 1; z >= 0; z -= 1) {
      const tileId = layers[z][index];

      if (tileId === 0) {
        continue;
      }

      const tag = terrainTagForTileId(profile, tileId);

      if (tag > 0) {
        cells[index] = tag & 0xff;
        break;
      }
    }
  }

  return cells;
}

export function isSolidCollisionCell(cellByte: number) {
  return (cellByte & PASSAGE_SOLID_MASK) === PASSAGE_SOLID_MASK;
}
