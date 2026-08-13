// The map layer for server-synced companion entities: follower venomons
// (party leaders trailing their trainers) and /pelota beach balls. Subscribes
// to the module stores' rosters; per-frame movement stays inside each sprite.

import { useEffect, useState } from "react";
import { getFollowers, subscribeFollowers } from "./followerActors";
import { getBeachBalls, subscribeBeachBalls } from "./beachBalls";
import FollowerSprite from "./FollowerSprite";
import BeachBallSprite from "./BeachBallSprite";

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
