/**
 * Register global slash commands for the ticket-sale Discord bot.
 * Usage: npm run discord:register-commands
 *
 * Requires DISCORD_BOT_TOKEN + AUTH_DISCORD_ID (or DISCORD_TICKET_BOT_* overrides).
 * Set Interactions Endpoint URL in Discord Developer Portal to:
 *   https://slotto.gg/api/discord/interactions
 */
import "dotenv/config";

import {
  discordTicketBotClientId,
  discordTicketBotToken,
} from "../src/lib/discord-ticket-bot/config";

async function main() {
  const token = discordTicketBotToken();
  const appId = discordTicketBotClientId();
  if (!token || !appId) {
    console.error(
      "Set DISCORD_BOT_TOKEN and AUTH_DISCORD_ID (same Discord app as profile login).",
    );
    process.exit(1);
  }

  const commands = [
    {
      name: "slotto-setup",
      description:
        "Choose the channel where Slotto posts ticket purchase announcements",
      options: [
        {
          name: "channel",
          description: "Text channel for ticket sale embeds",
          type: 7,
          required: true,
          channel_types: [0],
        },
      ],
    },
  ];

  const res = await fetch(
    `https://discord.com/api/v10/applications/${appId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    console.error(`Discord API ${res.status}:`, text);
    process.exit(1);
  }
  console.info("Registered commands:", text);
  console.info(
    "\nDiscord Developer Portal → your app → General → Interactions Endpoint URL:",
  );
  console.info("  https://slotto.gg/api/discord/interactions");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
