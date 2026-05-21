"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { currentAdminAddress } from "@/lib/admin-session";
import type { ProjectFormState } from "@/lib/project-form-state";
import { resolveProjectImageFromForm } from "@/lib/project-image-form";
import { deleteProjectUploadFile, isProjectUploadPath } from "@/lib/project-image-upload";
import {
  cleanupReplacedTokenImage,
  resolveProjectTokenFromForm,
} from "@/lib/parse-project-token-form";
import { validateCollectionsJson } from "@/lib/project-collections";
import { isValidSlug, normalizeSlugInput, slugifyName } from "@/lib/project-slug";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function assertAdmin(): Promise<ProjectFormState | null> {
  if (!(await currentAdminAddress())) {
    return { ok: false, message: "Not signed in as admin. Open /admin/login." };
  }
  return null;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const gate = await assertAdmin();
  if (gate) return gate;

  const name = str(formData, "name");
  if (!name) return { ok: false, message: "Name is required." };

  const slugRaw = normalizeSlugInput(str(formData, "slug"));
  const slug = slugRaw || slugifyName(name);
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      message:
        "Slug must be 2–80 chars, lowercase letters, numbers, and hyphens only (e.g. my-project). Leave blank to auto-generate from the name.",
    };
  }

  const reviewMd = str(formData, "reviewMd");
  if (!reviewMd) return { ok: false, message: "Review (Markdown) is required." };

  let collectionsParsed: ReturnType<typeof validateCollectionsJson>;
  try {
    collectionsParsed = validateCollectionsJson(str(formData, "collectionsJson"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid collections." };
  }

  const bannerRes = await resolveProjectImageFromForm(formData, "bannerFile", "bannerImageUrl");
  if (bannerRes.error) return { ok: false, message: bannerRes.error };
  const listingRes = await resolveProjectImageFromForm(formData, "listingFile", "listingImageUrl");
  if (listingRes.error) return { ok: false, message: listingRes.error };

  const tokenRes = await resolveProjectTokenFromForm(formData);
  if (tokenRes.error) return { ok: false, message: tokenRes.error };

  const published = formData.get("published") === "on";

  const admin = await prisma.adminWallet.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const data: Prisma.ProjectCreateInput = {
    slug,
    name,
    tagline: null,
    likes: 0,
    reviewMd,
    collections: collectionsParsed.collections as unknown as Prisma.InputJsonValue,
    meUrl: collectionsParsed.meUrl,
    meUrls:
      collectionsParsed.meUrls.length > 0
        ? (collectionsParsed.meUrls as unknown as Prisma.InputJsonValue)
        : undefined,
    marketplaces: Prisma.JsonNull,
    discordUrl: str(formData, "discordUrl") || null,
    twitterUrl: str(formData, "twitterUrl") || null,
    websiteUrl: str(formData, "websiteUrl") || null,
    tokenMint: tokenRes.tokenMint,
    tokenLiquid: tokenRes.tokenLiquid,
    tokenImageUrl: tokenRes.tokenImageUrl,
    tokenName: tokenRes.tokenName,
    bannerImageUrl: bannerRes.url,
    listingImageUrl: listingRes.url,
    published,
    ...(admin ? { createdBy: { connect: { id: admin.id } } } : {}),
  };

  try {
    await prisma.project.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await deleteProjectUploadFile(bannerRes.url);
      await deleteProjectUploadFile(listingRes.url);
      return { ok: false, message: "That slug is already in use. Pick another slug." };
    }
    console.error(e);
    await deleteProjectUploadFile(bannerRes.url);
    await deleteProjectUploadFile(listingRes.url);
    return { ok: false, message: "Could not save. Check the database connection and try again." };
  }

  redirect(`/admin/projects/${slug}/edit?created=1`);
}

export async function updateProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const gate = await assertAdmin();
  if (gate) return gate;

  const id = str(formData, "projectId");
  if (!id) return { ok: false, message: "Missing project id." };

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "Project not found." };

  const name = str(formData, "name");
  if (!name) return { ok: false, message: "Name is required." };

  const slugRaw = normalizeSlugInput(str(formData, "slug"));
  const slug = slugRaw || slugifyName(name);
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      message:
        "Slug must be 2–80 chars, lowercase letters, numbers, and hyphens only. Leave blank to auto-generate from the name.",
    };
  }

  const reviewMd = str(formData, "reviewMd");
  if (!reviewMd) return { ok: false, message: "Review (Markdown) is required." };

  let collectionsParsed: ReturnType<typeof validateCollectionsJson>;
  try {
    collectionsParsed = validateCollectionsJson(str(formData, "collectionsJson"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid collections." };
  }

  const bannerRes = await resolveProjectImageFromForm(formData, "bannerFile", "bannerImageUrl");
  if (bannerRes.error) return { ok: false, message: bannerRes.error };
  const listingRes = await resolveProjectImageFromForm(formData, "listingFile", "listingImageUrl");
  if (listingRes.error) return { ok: false, message: listingRes.error };

  const tokenRes = await resolveProjectTokenFromForm(formData, {
    tokenImageUrl: existing.tokenImageUrl,
    tokenName: existing.tokenName,
  });
  if (tokenRes.error) return { ok: false, message: tokenRes.error };

  const newBanner = bannerRes.url;
  const newListing = listingRes.url;

  const published = formData.get("published") === "on";

  try {
    await prisma.project.update({
      where: { id },
      data: {
        slug,
        name,
        tagline: null,
        reviewMd,
        collections: collectionsParsed.collections as unknown as Prisma.InputJsonValue,
        meUrl: collectionsParsed.meUrl,
        meUrls:
          collectionsParsed.meUrls.length > 0
            ? (collectionsParsed.meUrls as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        marketplaces: Prisma.JsonNull,
        discordUrl: str(formData, "discordUrl") || null,
        twitterUrl: str(formData, "twitterUrl") || null,
        websiteUrl: str(formData, "websiteUrl") || null,
        tokenMint: tokenRes.tokenMint,
        tokenLiquid: tokenRes.tokenLiquid,
        tokenImageUrl: tokenRes.tokenImageUrl,
        tokenName: tokenRes.tokenName,
        bannerImageUrl: newBanner,
        listingImageUrl: newListing,
        stats: Prisma.JsonNull,
        published,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      if (newBanner !== existing.bannerImageUrl && isProjectUploadPath(newBanner)) {
        await deleteProjectUploadFile(newBanner);
      }
      if (newListing !== existing.listingImageUrl && isProjectUploadPath(newListing)) {
        await deleteProjectUploadFile(newListing);
      }
      return { ok: false, message: "That slug is already in use." };
    }
    console.error(e);
    if (newBanner !== existing.bannerImageUrl && isProjectUploadPath(newBanner)) {
      await deleteProjectUploadFile(newBanner);
    }
    if (newListing !== existing.listingImageUrl && isProjectUploadPath(newListing)) {
      await deleteProjectUploadFile(newListing);
    }
    return { ok: false, message: "Could not update. Check the database connection and try again." };
  }

  if (newBanner !== existing.bannerImageUrl && isProjectUploadPath(existing.bannerImageUrl)) {
    await deleteProjectUploadFile(existing.bannerImageUrl);
  }
  if (newListing !== existing.listingImageUrl && isProjectUploadPath(existing.listingImageUrl)) {
    await deleteProjectUploadFile(existing.listingImageUrl);
  }
  await cleanupReplacedTokenImage(existing.tokenImageUrl, tokenRes.tokenImageUrl);

  redirect(`/admin/projects/${slug}/edit?saved=1`);
}

export async function deleteProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const gate = await assertAdmin();
  if (gate) return gate;

  const id = str(formData, "projectId");
  if (!id) return { ok: false, message: "Missing project id." };

  const row = await prisma.project.findUnique({
    where: { id },
    select: { bannerImageUrl: true, listingImageUrl: true, tokenImageUrl: true },
  });
  if (!row) return { ok: false, message: "Project not found." };

  try {
    await prisma.project.delete({ where: { id } });
  } catch {
    return { ok: false, message: "Could not delete this project." };
  }

  await deleteProjectUploadFile(row.bannerImageUrl);
  await deleteProjectUploadFile(row.listingImageUrl);
  await deleteProjectUploadFile(row.tokenImageUrl);

  redirect("/admin/projects?deleted=1");
}
