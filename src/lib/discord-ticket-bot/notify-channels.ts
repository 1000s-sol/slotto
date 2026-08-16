import { prisma } from "@/lib/prisma";
import { getDrawDisplayMeta } from "@/lib/lottery/draw-display-db";
import {
  discordLotteryTestChannelId,
  lotteryTestMode,
} from "@/lib/lottery/test-mode";

/** Channel IDs for lottery Discord embeds (test channel or /slotto-setup guilds). */
export async function resolveDiscordNotifyChannelIds(opts?: {
  onChainDrawId?: number;
}): Promise<string[]> {
  const testChannel = discordLotteryTestChannelId();
  let testOnly = lotteryTestMode();
  if (opts?.onChainDrawId != null) {
    const meta = await getDrawDisplayMeta(opts.onChainDrawId);
    if (!meta || meta.kind === "TEST") testOnly = true;
  }

  if (testOnly) {
    if (!testChannel) {
      console.warn(
        "[discord] test draw/mode — DISCORD_LOTTERY_TEST_CHANNEL_ID unset; not posting to public guilds",
      );
      return [];
    }
    return [testChannel];
  }

  const guilds = await prisma.discordTicketBotGuild.findMany({
    where: { enabled: true },
  });
  return guilds.map((g) => g.channelId);
}
