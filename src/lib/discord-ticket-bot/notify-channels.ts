import { prisma } from "@/lib/prisma";
import {
  discordLotteryTestChannelId,
  lotteryTestMode,
} from "@/lib/lottery/test-mode";

/** Channel IDs for lottery Discord embeds (test channel or /slotto-setup guilds). */
export async function resolveDiscordNotifyChannelIds(): Promise<string[]> {
  const testChannel = discordLotteryTestChannelId();
  if (lotteryTestMode() && testChannel) {
    return [testChannel];
  }

  const guilds = await prisma.discordTicketBotGuild.findMany({
    where: { enabled: true },
  });
  return guilds.map((g) => g.channelId);
}
