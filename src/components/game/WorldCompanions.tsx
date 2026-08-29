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
import { getPetGround, PET_MENU_EVENT, subscribeHousePets } from "./housePets";
import { assetUrl } from "../tilemap/serverAssets";

const EGG_ICON_SRC = "/migration_exports/pictures/summaryEgg.PNG";

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

/** Things house pets left on the floor: eggs to collect, messes to clean (housePets.ts). */
export function PetGroundLayer({ mapId, cellSize }: { mapId: string; cellSize: number }) {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeHousePets(() => setVersion((value) => value + 1)), []);

  return (
    <>
      {getPetGround(mapId).map((thing) => (
        <div
          key={thing.id}
          data-pet-ground={thing.kind}
          data-pet-ground-id={thing.id}
          title={thing.kind === "egg" ? `Huevo de ${thing.byPetName}` : `${thing.byPetName} vomitó aquí`}
          onClick={(event) => {
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent(PET_MENU_EVENT, { detail: { groundId: thing.id } }));
          }}
          style={{
            position: "absolute",
            left: `${thing.x * cellSize}px`,
            top: `${thing.y * cellSize}px`,
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            zIndex: 997,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          {thing.kind === "egg" ? (
            <img
              src={assetUrl(EGG_ICON_SRC)}
              alt="Huevo"
              style={{ maxWidth: `${cellSize * 0.8}px`, maxHeight: `${cellSize * 0.9}px`, imageRendering: "pixelated" }}
              draggable={false}
            />
          ) : (
            <span
              style={{
                fontSize: `${Math.round(cellSize * 0.55)}px`,
                lineHeight: 1,
                filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))",
                marginBottom: "2px"
              }}
            >
              🤮
            </span>
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
