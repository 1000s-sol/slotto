"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { currentAdminAddress } from "@/lib/admin-session";
import type { ProjectFormState } from "@/lib/project-form-state";
import { resolveProjectImageFromForm } from "@/lib/project-image-form";
import { deleteProjectUploadFile, isProjectUploadPath } from "@/lib/project-image-upload";
import { isValidSlug, normalizeSlugInput, slugifyName } from "@/lib/project-slug";
import { prisma } from "@/lib/prisma";

function parseMeUrlsJson(raw: string): { primary: string | null; json: Prisma.InputJsonValue | typeof Prisma.JsonNull } {
  const t = raw.trim() || "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    throw new Error("Magic Eden URLs: invalid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("Magic Eden URLs must be a JSON array of strings.");
  const lines: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const x = parsed[i];
    if (typeof x !== "string") throw new Error(`Magic Eden URL at position ${i + 1} must be a string.`);
    const line = x.trim();
    if (line) lines.push(line);
  }
  if (!lines.length) return { primary: null, json: Prisma.JsonNull };
  for (let i = 0; i < lines.length; i++) {
    if (!/^https?:\/\//i.test(lines[i])) {
      throw new Error(`Magic Eden URL ${i + 1} must start with http:// or https://.`);
    }
  }
  return { primary: lines[0], json: lines as unknown as Prisma.InputJsonValue };
}

function parseMarketplacesJson(raw: string): Prisma.InputJsonValue | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    throw new Error("Marketplaces JSON is not valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("Marketplaces must be a JSON array.");
  const out: { label: string; href: string }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") throw new Error(`Marketplaces[${i}] must be an object.`);
    const label = String((row as Record<string, unknown>).label ?? "").trim();
    const href = String((row as Record<string, unknown>).href ?? "").trim();
    if (!label || !href) throw new Error(`Marketplaces[${i}] needs both "label" and "href".`);
    if (!/^https?:\/\//i.test(href)) throw new Error(`Marketplaces[${i}] href must start with http:// or https://`);
    out.push({ label, href });
  }
  return out;
}

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

  let meUrlsParsed: { primary: string | null; json: Prisma.InputJsonValue | typeof Prisma.JsonNull };
  try {
    meUrlsParsed = parseMeUrlsJson(str(formData, "meUrlsJson"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid Magic Eden URLs." };
  }

  let marketplaces: Prisma.InputJsonValue | undefined;
  try {
    marketplaces = parseMarketplacesJson(str(formData, "marketplacesJson"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid marketplaces." };
  }

  const bannerRes = await resolveProjectImageFromForm(formData, "bannerFile", "bannerImageUrl");
  if (bannerRes.error) return { ok: false, message: bannerRes.error };
  const listingRes = await resolveProjectImageFromForm(formData, "listingFile", "listingImageUrl");
  if (listingRes.error) return { ok: false, message: listingRes.error };

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
    meUrl: meUrlsParsed.primary,
    meUrls: meUrlsParsed.json === Prisma.JsonNull ? undefined : meUrlsParsed.json,
    discordUrl: str(formData, "discordUrl") || null,
    twitterUrl: str(formData, "twitterUrl") || null,
    tokenMint: str(formData, "tokenMint") || null,
    bannerImageUrl: bannerRes.url,
    listingImageUrl: listingRes.url,
    published,
    ...(admin ? { createdBy: { connect: { id: admin.id } } } : {}),
    ...(marketplaces !== undefined ? { marketplaces } : {}),
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

  let marketplaces: Prisma.InputJsonValue | undefined;
  try {
    marketplaces = parseMarketplacesJson(str(formData, "marketplacesJson"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid marketplaces." };
  }

  let meUrlsParsed: { primary: string | null; json: Prisma.InputJsonValue | typeof Prisma.JsonNull };
  try {
    meUrlsParsed = parseMeUrlsJson(str(formData, "meUrlsJson"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid Magic Eden URLs." };
  }

  const bannerRes = await resolveProjectImageFromForm(formData, "bannerFile", "bannerImageUrl");
  if (bannerRes.error) return { ok: false, message: bannerRes.error };
  const listingRes = await resolveProjectImageFromForm(formData, "listingFile", "listingImageUrl");
  if (listingRes.error) return { ok: false, message: listingRes.error };

  const newBanner = bannerRes.url;
  const newListing = listingRes.url;

  const published = formData.get("published") === "on";

  const marketplacesData =
    marketplaces === undefined ? Prisma.JsonNull : (marketplaces as Prisma.InputJsonValue);

  try {
    await prisma.project.update({
      where: { id },
      data: {
        slug,
        name,
        tagline: null,
        reviewMd,
        meUrl: meUrlsParsed.primary,
        meUrls: meUrlsParsed.json,
        discordUrl: str(formData, "discordUrl") || null,
        twitterUrl: str(formData, "twitterUrl") || null,
        tokenMint: str(formData, "tokenMint") || null,
        bannerImageUrl: newBanner,
        listingImageUrl: newListing,
        stats: Prisma.JsonNull,
        marketplaces: marketplacesData,
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
    select: { bannerImageUrl: true, listingImageUrl: true },
  });
  if (!row) return { ok: false, message: "Project not found." };

  try {
    await prisma.project.delete({ where: { id } });
  } catch {
    return { ok: false, message: "Could not delete this project." };
  }

  await deleteProjectUploadFile(row.bannerImageUrl);
  await deleteProjectUploadFile(row.listingImageUrl);

  redirect("/admin/projects?deleted=1");
}
