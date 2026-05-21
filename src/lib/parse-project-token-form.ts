import { resolveProjectImageFromForm } from "@/lib/project-image-form";
import { deleteProjectUploadFile, isProjectUploadPath } from "@/lib/project-image-upload";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type ResolvedProjectToken = {
  tokenMint: string | null;
  tokenLiquid: boolean;
  tokenImageUrl: string | null;
  error?: string;
};

export async function resolveProjectTokenFromForm(
  formData: FormData,
  existing?: { tokenImageUrl: string | null },
): Promise<ResolvedProjectToken> {
  const tokenMint = str(formData, "tokenMint") || null;
  const tokenLiquid = formData.get("tokenLiquid") !== "false";

  if (!tokenMint) {
    return { tokenMint: null, tokenLiquid: true, tokenImageUrl: null };
  }

  if (tokenLiquid) {
    return { tokenMint, tokenLiquid: true, tokenImageUrl: null };
  }

  const imgRes = await resolveProjectImageFromForm(formData, "tokenImageFile", "tokenImageUrl");
  if (imgRes.error) {
    return { tokenMint, tokenLiquid: false, tokenImageUrl: null, error: imgRes.error };
  }

  let tokenImageUrl = imgRes.url ?? existing?.tokenImageUrl ?? null;
  if (!tokenImageUrl) {
    return {
      tokenMint,
      tokenLiquid: false,
      tokenImageUrl: null,
      error: "Non-liquid tokens need a token image (URL or file upload).",
    };
  }

  return { tokenMint, tokenLiquid: false, tokenImageUrl };
}

/** Remove replaced uploaded token image after a successful save. */
export async function cleanupReplacedTokenImage(
  previousUrl: string | null | undefined,
  nextUrl: string | null,
): Promise<void> {
  if (previousUrl && previousUrl !== nextUrl && isProjectUploadPath(previousUrl)) {
    await deleteProjectUploadFile(previousUrl);
  }
}
