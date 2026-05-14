import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function parseWallet(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return new PublicKey(raw.trim()).toBase58();
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(_req.url);
  const wallet = parseWallet(url.searchParams.get("wallet"));

  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    select: { id: true, likes: true },
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!wallet) {
    return NextResponse.json({ likes: project.likes, liked: false });
  }

  const like = await prisma.projectLike.findUnique({
    where: { projectId_wallet: { projectId: project.id, wallet } },
  });
  return NextResponse.json({ likes: project.likes, liked: !!like });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const wallet = parseWallet(
    typeof body === "object" && body !== null && "wallet" in body
      ? (body as { wallet: unknown }).wallet
      : undefined,
  );
  if (!wallet) return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.projectLike.findUnique({
    where: { projectId_wallet: { projectId: project.id, wallet } },
  });

  let liked: boolean;
  try {
    if (existing) {
      await prisma.$transaction([
        prisma.projectLike.delete({ where: { id: existing.id } }),
        prisma.project.update({
          where: { id: project.id },
          data: { likes: { decrement: 1 } },
        }),
      ]);
      liked = false;
    } else {
      await prisma.$transaction([
        prisma.projectLike.create({ data: { projectId: project.id, wallet } }),
        prisma.project.update({
          where: { id: project.id },
          data: { likes: { increment: 1 } },
        }),
      ]);
      liked = true;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const p = await prisma.project.findUnique({
        where: { id: project.id },
        select: { likes: true },
      });
      return NextResponse.json({ likes: p?.likes ?? 0, liked: true });
    }
    throw e;
  }

  const updated = await prisma.project.findUnique({
    where: { id: project.id },
    select: { likes: true },
  });

  return NextResponse.json({ likes: updated?.likes ?? 0, liked });
}
