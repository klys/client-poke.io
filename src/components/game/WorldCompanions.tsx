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
