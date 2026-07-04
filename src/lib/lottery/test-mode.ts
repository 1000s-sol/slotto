/** When true: Discord → test channel, no @slottogg_ X posts. */
export function lotteryTestMode(): boolean {
  return process.env.LOTTERY_TEST_MODE?.trim().toLowerCase() === "true";
}

export function discordLotteryTestChannelId(): string | undefined {
  return process.env.DISCORD_LOTTERY_TEST_CHANNEL_ID?.trim() || undefined;
}

/** Official X draw announcements (live + ended). */
export function lotteryXPostingEnabled(): boolean {
  if (lotteryTestMode()) return false;
  return process.env.SLOTTO_X_POSTING_ENABLED?.trim().toLowerCase() === "true";
}
