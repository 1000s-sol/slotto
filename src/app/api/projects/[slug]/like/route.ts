import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { readProfileSessionCookie } from "@/lib/profile-session";
import { userHasLikedProject } from "@/lib/user-profile-db";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const profileId = await readProfileSessionCookie();

  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    select: { id: true, likes: true },
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!profileId) {
    return NextResponse.json({ likes: project.likes, liked: false });
  }

  const liked = await userHasLikedProject(profileId, project.id);
  return NextResponse.json({ likes: project.likes, liked });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const profileId = await readProfileSessionCookie();
  if (!profileId) {
    return NextResponse.json(
      { error: "sign_in_required", message: "Connect Discord or X to like projects." },
      { status: 401 },
    );
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    select: { discordId: true, xId: true },
  });
  if (!profile?.discordId && !profile?.xId) {
    return NextResponse.json(
      { error: "social_required", message: "Connect Discord or X on your profile first." },
      { status: 403 },
    );
  }

  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.projectLike.findUnique({
    where: { projectId_userProfileId: { projectId: project.id, userProfileId: profileId } },
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
        prisma.projectLike.create({
          data: { projectId: project.id, userProfileId: profileId },
        }),
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
