"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  createProjectAction,
  deleteProjectAction,
  updateProjectAction,
} from "@/app/admin/(dashboard)/projects/actions";
import type { ProjectFormState } from "@/lib/project-form-state";
import { projectFormInitialState } from "@/lib/project-form-state";
import { CollectionsEditor } from "@/components/admin/collections-editor";
import { emptyDefaults, type ProjectFormDefaults } from "@/lib/project-form-defaults";

function TokenMintEditor({
  defaultMint,
  defaultLiquid,
  defaultTokenImageUrl,
  defaultTokenName,
}: {
  defaultMint: string;
  defaultLiquid: boolean;
  defaultTokenImageUrl: string;
  defaultTokenName: string;
}) {
  const [liquid, setLiquid] = useState(defaultLiquid);

  useEffect(() => {
    setLiquid(defaultLiquid);
  }, [defaultLiquid]);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/25 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Project token</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Optional SPL mint for the project page. <strong className="text-muted">Liquid</strong> tokens are tradeable
          (Birdeye + ticker). Uncheck for utility tokens that are not tradeable — add a custom image and link to
          Solscan instead.
        </p>
      </div>
      <input type="hidden" name="tokenLiquid" value={liquid ? "true" : "false"} readOnly />
      <label className="flex flex-col gap-2 text-xs text-muted">
        Token mint (optional)
        <input
          name="tokenMint"
          defaultValue={defaultMint}
          placeholder="Mint address"
          className="rounded-xl border border-border bg-surface/60 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15 sm:text-sm"
        />
      </label>
      <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={liquid}
          onChange={(e) => setLiquid(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-accent-purple"
        />
        Liquid (tradeable on markets)
      </label>
      {!liquid ? (
        <>
          <label className="flex flex-col gap-2 text-xs text-muted">
            Token name
            <input
              name="tokenName"
              defaultValue={defaultTokenName}
              placeholder="e.g. BUX"
              className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
            />
          </label>
          <ImageFieldBlock
            title="Token image"
            description="Shown on the public project page for non-liquid tokens. Required when Liquid is unchecked."
            urlName="tokenImageUrl"
            fileName="tokenImageFile"
            defaultUrl={defaultTokenImageUrl}
            previewUrl={defaultTokenImageUrl}
          />
        </>
      ) : null}
    </div>
  );
}

function ImageFieldBlock({
  title,
  description,
  urlName,
  fileName,
  defaultUrl,
  previewUrl,
}: {
  title: string;
  description: string;
  urlName: string;
  fileName: string;
  defaultUrl: string;
  previewUrl: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/25 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{description}</p>
      <label className="mt-3 flex flex-col gap-2 text-xs text-muted">
        Image URL (optional if you upload a file)
        <input
          name={urlName}
          type="text"
          inputMode="url"
          placeholder="https://… or /uploads/projects/…"
          defaultValue={defaultUrl}
          className="rounded-xl border border-border bg-surface/60 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15 sm:text-sm"
        />
      </label>
      <label className="mt-3 flex flex-col gap-2 text-xs text-muted">
        Upload file (PNG, JPEG, WebP, GIF — max 4 MB)
        <input
          name={fileName}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          className="text-xs text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
        />
      </label>
      <p className="mt-2 text-[11px] text-muted/80">
        If both are set, the <strong className="text-muted">upload</strong> wins. Leave both empty for no image.
      </p>
      {previewUrl ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Current</p>
          <img
            src={previewUrl}
            alt=""
            className="mt-1 max-h-28 max-w-full rounded-lg border border-border object-contain object-left"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}
    </div>
  );
}

export function ProjectForm({
  mode,
  projectId,
  defaults,
}: {
  mode: "create" | "edit";
  projectId?: string;
  defaults?: Partial<ProjectFormDefaults>;
}) {
  const merged = useMemo(() => ({ ...emptyDefaults, ...defaults }), [defaults]);
  const action = mode === "create" ? createProjectAction : updateProjectAction;
  const [state, formAction, pending] = useActionState(action, projectFormInitialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-8">
      {!state.ok && state.message ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {state.message}
        </div>
      ) : null}

      {mode === "edit" && projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-muted">
          <span className="inline-flex flex-wrap items-baseline gap-1">
            Name
            <span className="text-red-400" aria-hidden>
              *
            </span>
          </span>
          <input
            name="name"
            required
            defaultValue={merged.name}
            className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs text-muted">
          URL slug (optional — auto from name if empty)
          <input
            name="slug"
            defaultValue={merged.slug}
            placeholder="my-cool-project"
            className="rounded-xl border border-border bg-surface/60 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          />
        </label>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="published"
          defaultChecked={merged.published}
          className="h-4 w-4 rounded border-border accent-accent-purple"
        />
        Published (visible on public /projects)
      </label>

      <label className="flex flex-col gap-2 text-xs text-muted">
        <span className="inline-flex flex-wrap items-baseline gap-1.5">
          Review
          <span className="text-red-400" aria-hidden>
            *
          </span>
          <span className="font-normal text-muted/90">(Markdown)</span>
        </span>
        <textarea
          name="reviewMd"
          required
          rows={14}
          defaultValue={merged.reviewMd}
          className="rounded-xl border border-border bg-surface/60 px-3 py-2 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15 sm:text-sm"
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImageFieldBlock
          title="Banner image (wide)"
          description="Used as the large hero on the project page. Recommended wide aspect (~3:1 or wider)."
          urlName="bannerImageUrl"
          fileName="bannerFile"
          defaultUrl={merged.bannerImageUrl}
          previewUrl={merged.bannerImageUrl}
        />
        <ImageFieldBlock
          title="Listing thumbnail (square)"
          description="Shown in the public project directory — especially on small screens. Use a square or near-square image (~1:1)."
          urlName="listingImageUrl"
          fileName="listingFile"
          defaultUrl={merged.listingImageUrl}
          previewUrl={merged.listingImageUrl}
        />
      </div>

      <CollectionsEditor
        key={projectId ?? "new-project"}
        initialCollections={merged.collectionsInitial}
      />

      <label className="flex flex-col gap-2 text-xs text-muted">
        Project website (optional)
        <input
          name="websiteUrl"
          type="text"
          inputMode="url"
          defaultValue={merged.websiteUrl}
          placeholder="https://example.com"
          className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
        />
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-muted">
          Discord URL
          <input
            name="discordUrl"
            type="url"
            defaultValue={merged.discordUrl}
            className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs text-muted">
          X (Twitter) URL
          <input
            name="twitterUrl"
            type="url"
            defaultValue={merged.twitterUrl}
            className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          />
        </label>
      </div>

      <TokenMintEditor
        defaultMint={merged.tokenMint}
        defaultLiquid={merged.tokenLiquid}
        defaultTokenImageUrl={merged.tokenImageUrl}
        defaultTokenName={merged.tokenName}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20 disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function DeleteProjectForm({ projectId, label }: { projectId: string; label: string }) {
  const [state, formAction, pending] = useActionState(deleteProjectAction, projectFormInitialState);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-red-500/50 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
      >
        {pending ? "Deleting…" : `Delete “${label}”`}
      </button>
      {!state.ok && state.message ? (
        <p className="mt-2 text-xs text-red-300">{state.message}</p>
      ) : null}
    </form>
  );
}
