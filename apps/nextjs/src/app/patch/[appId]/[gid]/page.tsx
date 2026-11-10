import { notFound } from "next/navigation";

import { PatchReader } from "./patch-reader";

export default async function PatchPage({
  params,
}: {
  params: Promise<{ appId: string; gid: string }>;
}) {
  const { appId, gid } = await params;
  const steamAppId = Number(appId);
  if (
    !/^\d+$/.test(appId) ||
    !Number.isSafeInteger(steamAppId) ||
    steamAppId <= 0 ||
    steamAppId > 2147483647 ||
    !/^\d{1,24}$/.test(gid)
  )
    notFound();
  return <PatchReader steamAppId={steamAppId} gid={gid} />;
}
