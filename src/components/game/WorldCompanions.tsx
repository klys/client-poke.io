// The map layer for server-synced companion entities: follower venomons
// (party leaders trailing their trainers), /pelota beach balls and the
// global berry plots. Subscribes
// to the module stores' rosters; per-frame movement stays inside each sprite.

import { useEffect, useState } from "react";
import { getFollowers, subscribeFollowers } from "./followerActors";
import { getBeachBalls, subscribeBeachBalls } from "./beachBalls";
import FollowerSprite from "./FollowerSprite";
import BeachBallSprite from "./BeachBallSprite";
import { getBerryPlots, subscribeBerryPlots } from "./berryPlots";
import BerryPlantSprite from "./BerryPlantSprite";
import { getHouseFurniture, subscribeHouses } from "./houses";
import { assetUrl } from "../tilemap/serverAssets";

export function Followers({ mapId, cellSize }: { mapId: string; cellSize: number }) {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeFollowers(() => setVersion((value) => value + 1)), []);

  return (
    <>
      {getFollowers(mapId).map((follower) => (
        <FollowerSprite
          key={follower.ownerId}
          follower={follower}
          mapId={mapId}
          cellSize={cellSize}
        />
      ))}
    </>
  );
}

export function BeachBallsLayer({ mapId, cellSize }: { mapId: string; cellSize: number }) {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeBeachBalls(() => setVersion((value) => value + 1)), []);

  return (
    <>
      {getBeachBalls(mapId).map((ball) => (
        <BeachBallSprite key={ball.id} ball={ball} mapId={mapId} cellSize={cellSize} />
      ))}
    </>
  );
}

/** Furniture placed inside a house instance (see houses.ts). */
export function HouseFurnitureLayer({ mapId, cellSize }: { mapId: string; cellSize: number }) {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeHouses(() => setVersion((value) => value + 1)), []);

  return (
    <>
      {getHouseFurniture(mapId).map((piece) => (
        <div
          key={piece.id}
          data-house-furniture={piece.id}
          data-house-furniture-object={piece.objectId}
          title={piece.itemName}
          style={{
            position: "absolute",
            left: `${piece.x * cellSize}px`,
            top: `${piece.y * cellSize}px`,
            width: `${piece.imageSrc ? piece.width ?? cellSize : cellSize}px`,
            height: `${piece.imageSrc ? piece.height ?? cellSize : cellSize}px`,
            zIndex: 998,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          {piece.imageSrc ? (
            // Linked map object: drawn exactly like an authored one (GameObject),
            // top-left anchored at its px size.
            <img
              src={assetUrl(piece.imageSrc)}
              alt={piece.itemName}
              width={piece.width ?? cellSize}
              height={piece.height ?? cellSize}
              style={{ imageRendering: "pixelated", objectPosition: "center" }}
              draggable={false}
            />
          ) : piece.iconSrc ? (
            <img
              src={assetUrl(piece.iconSrc)}
              alt={piece.itemName}
              style={{ maxWidth: `${cellSize}px`, maxHeight: `${cellSize * 1.5}px`, imageRendering: "pixelated" }}
              draggable={false}
            />
          ) : (
            <span style={{ fontSize: `${Math.round(cellSize * 0.7)}px`, lineHeight: 1 }}>🪑</span>
          )}
        </div>
      ))}
    </>
  );
}

/** Global berry plots (server-timed growth; see berryPlots.ts). */
export function BerryPlantsLayer({ mapId, cellSize }: { mapId: string; cellSize: number }) {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeBerryPlots(() => setVersion((value) => value + 1)), []);

  return (
    <>
      {getBerryPlots(mapId).map((plot) => (
        <BerryPlantSprite key={plot.id} plot={plot} cellSize={cellSize} />
      ))}
    </>
  );
}
