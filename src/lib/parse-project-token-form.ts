import { resolveProjectImageFromForm } from "@/lib/project-image-form";
import { deleteProjectUploadFile, isProjectUploadPath } from "@/lib/project-image-upload";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type ResolvedProjectToken = {
  tokenMint: string | null;
  tokenLiquid: boolean;
  tokenImageUrl: string | null;
  tokenName: string | null;
  error?: string;
};

const emptyToken: ResolvedProjectToken = {
  tokenMint: null,
  tokenLiquid: true,
  tokenImageUrl: null,
  tokenName: null,
};

export async function resolveProjectTokenFromForm(
  formData: FormData,
  existing?: { tokenImageUrl: string | null; tokenName: string | null },
): Promise<ResolvedProjectToken> {
  const tokenMint = str(formData, "tokenMint") || null;
  const tokenLiquid = formData.get("tokenLiquid") !== "false";

  if (!tokenMint) {
    return emptyToken;
  }

  if (tokenLiquid) {
    return { tokenMint, tokenLiquid: true, tokenImageUrl: null, tokenName: null };
  }

  const tokenName = str(formData, "tokenName");
  if (!tokenName) {
    return {
      tokenMint,
      tokenLiquid: false,
      tokenImageUrl: null,
      tokenName: null,
      error: "Non-liquid tokens need a token name (e.g. BUX).",
    };
  }

  const imgRes = await resolveProjectImageFromForm(formData, "tokenImageFile", "tokenImageUrl");
  if (imgRes.error) {
    return { tokenMint, tokenLiquid: false, tokenImageUrl: null, tokenName, error: imgRes.error };
  }

  let tokenImageUrl = imgRes.url ?? existing?.tokenImageUrl ?? null;
  if (!tokenImageUrl) {
    return {
      tokenMint,
      tokenLiquid: false,
      tokenImageUrl: null,
      tokenName,
      error: "Non-liquid tokens need a token image (URL or file upload).",
    };
  }

  return { tokenMint, tokenLiquid: false, tokenImageUrl, tokenName };
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
