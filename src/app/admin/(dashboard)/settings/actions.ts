"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentAdminAddress } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { SITE_SETTINGS_ROW_ID } from "@/lib/site-settings";

export async function updateFeaturedProjectAction(formData: FormData) {
  if (!(await currentAdminAddress())) {
    redirect("/admin/login?next=/admin/settings");
  }

  const raw = String(formData.get("featuredProjectSlug") ?? "").trim();
  const slug = raw === "" ? null : raw;

  if (slug) {
    const ok = await prisma.project.findFirst({
      where: { slug, published: true },
      select: { id: true },
    });
    if (!ok) {
      redirect("/admin/settings?error=not-found");
    }
  }

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ROW_ID },
    create: { id: SITE_SETTINGS_ROW_ID, featuredProjectSlug: slug },
    update: { featuredProjectSlug: slug },
  });

  revalidatePath("/projects");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
