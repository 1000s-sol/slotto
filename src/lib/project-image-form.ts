import { saveProjectImageFile } from "@/lib/project-image-upload";
import { isSafeHttpsOrRelativeUrl } from "@/lib/safe-url";

/**
 * Prefer a new file upload; otherwise use the URL field (trimmed), or null if empty.
 */
export async function resolveProjectImageFromForm(
  formData: FormData,
  fileFieldName: string,
  urlFieldName: string,
): Promise<{ url: string | null; error?: string }> {
  const raw = formData.get(fileFieldName);
  if (raw instanceof File && raw.size > 0) {
    try {
      const url = await saveProjectImageFile(raw);
      return { url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save image.";
      return { url: null, error: msg };
    }
  }
  const urlStr = String(formData.get(urlFieldName) ?? "").trim();
  if (urlStr && !isSafeHttpsOrRelativeUrl(urlStr)) {
    return { url: null, error: "Image URL must be an https:// link." };
  }
  return { url: urlStr || null };
}
