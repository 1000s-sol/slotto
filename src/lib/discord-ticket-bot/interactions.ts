import { prisma } from "@/lib/prisma";

const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

type DiscordInteraction = {
  type: number;
  id: string;
  token: string;
  guild_id?: string;
  member?: {
    permissions?: string;
    user?: { id: string };
  };
  user?: { id: string };
  data?: {
    name?: string;
    options?: Array<{
      name: string;
      type: number;
      value?: string;
    }>;
  };
};

function interactionResponse(
  body: Record<string, unknown>,
  ephemeral = false,
): Response {
  let payload = body;
  if (ephemeral && body.type === 4 && body.data && typeof body.data === "object") {
    payload = {
      ...body,
      data: { ...body.data, flags: 64 },
    };
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function hasManageGuild(permissions: string | undefined): boolean {
  if (!permissions) return false;
  try {
    const bits = BigInt(permissions);
    return (bits & ADMINISTRATOR) !== BigInt(0) || (bits & MANAGE_GUILD) !== BigInt(0);
  } catch {
    return false;
  }
}

export async function handleDiscordTicketBotInteraction(
  rawBody: string,
): Promise<Response> {
  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (interaction.type === 1) {
    return interactionResponse({ type: 1 });
  }

  if (interaction.type !== 2) {
    return interactionResponse({
      type: 4,
      data: { content: "Unsupported interaction." },
    }, true);
  }

  const command = interaction.data?.name;
  if (command !== "slotto-setup") {
    return interactionResponse({
      type: 4,
      data: { content: "Unknown command." },
    }, true);
  }

  const guildId = interaction.guild_id;
  if (!guildId) {
    return interactionResponse({
      type: 4,
      data: { content: "This command can only be used in a server." },
    }, true);
  }

  const perms = interaction.member?.permissions;
  if (!hasManageGuild(perms)) {
    return interactionResponse({
      type: 4,
      data: {
        content:
          "You need **Administrator** or **Manage Server** to configure the Slotto bot.",
      },
    }, true);
  }

  const channelId = interaction.data?.options?.find((o) => o.name === "channel")
    ?.value;
  if (!channelId) {
    return interactionResponse({
      type: 4,
      data: { content: "Pick a text channel with the `channel` option." },
    }, true);
  }

  const setupById =
    interaction.member?.user?.id ?? interaction.user?.id ?? null;

  try {
    await prisma.discordTicketBotGuild.upsert({
      where: { guildId },
      create: {
        guildId,
        channelId,
        setupById,
        enabled: true,
      },
      update: {
        channelId,
        setupById,
        enabled: true,
      },
    });
  } catch (e) {
    console.error("[discord ticket bot] setup upsert failed:", e);
    return interactionResponse({
      type: 4,
      data: {
        content:
          "Could not save settings (database). Try again later or contact Slotto support.",
      },
    }, true);
  }

  return interactionResponse({
    type: 4,
    data: {
      content: [
        `Ticket sale announcements will post in <#${channelId}>.`,
        "",
        "Make sure the bot can **View Channel**, **Send Messages**, and **Embed Links** in that channel.",
        "Buyers on [slotto.gg](https://slotto.gg) will trigger embeds automatically.",
      ].join("\n"),
    },
  });
}
