import { notFound } from "next/navigation";

import { GameHub } from "./game-hub";

export default async function GamePage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const steamAppId = Number(appId);
  if (
    !/^\d+$/.test(appId) ||
    !Number.isSafeInteger(steamAppId) ||
    steamAppId <= 0 ||
    steamAppId > 2147483647
  )
    notFound();
  return <GameHub steamAppId={steamAppId} />;
}
