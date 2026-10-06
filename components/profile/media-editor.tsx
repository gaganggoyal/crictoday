"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  captionProfileImageAction,
  moveProfileImageAction,
  removeProfileImageAction,
  uploadProfileImageAction,
} from "@/app/profile-actions";
import { ProfileCover, ProfileLogo } from "@/components/profile/profile-picture";
import {
  IMAGE_ROLE_LABEL,
  IMAGE_SPEC,
  MAX_CAPTION,
  MAX_PHOTOS,
  imageSrc,
  type ImageRole,
} from "@/lib/domain/media";
import type { ProfileImage } from "@/lib/domain/types";
import { shrinkPicture } from "@/lib/media/shrink";

type Result = { ok: true } | { ok: false; errors: Record<string, string> };
type Message = { tone: "error" | "done"; text: string };

const firstError = (result: Result) =>
  result.ok ? "" : (Object.values(result.errors)[0] ?? "That did not work. Try again.");

const pickButton =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-4 text-sm font-medium has-[:disabled]:cursor-default has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link";
const smallButton =
  "inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-60";

/** The owner's logo, cover photo and gallery, each saved as soon as it is picked. */
export function MediaEditor({
  profile,
  name,
  logo,
  cover,
  photos,
}: {
  profile: string;
  name: string;
  logo: ProfileImage | null;
  cover: ProfileImage | null;
  photos: ProfileImage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const run = (work: () => Promise<Message | null>) =>
    startTransition(async () => {
      setMessage(null);
      const outcome = await work();
      setProgress(null);
      setMessage(outcome);
      router.refresh();
    });

  const upload = (role: ImageRole, files: File[]) =>
    run(async () => {
      const room = role === "photo" ? MAX_PHOTOS - photos.length : 1;
      const list = files.slice(0, Math.max(0, room));
      if (!list.length) {
        return { tone: "error", text: `You have ${MAX_PHOTOS} photos. Remove one to add another.` };
      }
      for (const [at, file] of list.entries()) {
        setProgress(
          list.length > 1
            ? `Adding photo ${at + 1} of ${list.length}`
            : `Adding your ${IMAGE_ROLE_LABEL[role]}`,
        );
        const body = new FormData();
        body.set("profile", profile);
        body.set("role", role);
        body.set("file", await shrinkPicture(file, IMAGE_SPEC[role].send, role === "logo"));
        const result: Result = await uploadProfileImageAction(body);
        if (!result.ok) return { tone: "error", text: `${file.name}: ${firstError(result)}` };
      }
      const left = files.length - list.length;
      if (left > 0) {
        return {
          tone: "error",
          text: `Added ${list.length}. ${left} more did not fit: a profile shows up to ${MAX_PHOTOS} photos.`,
        };
      }
      return {
        tone: "done",
        text:
          role === "photo"
            ? `${list.length === 1 ? "Photo" : `${list.length} photos`} added.`
            : `Your ${IMAGE_ROLE_LABEL[role]} is saved.`,
      };
    });

  const send = (
    action: (body: FormData) => Promise<Result>,
    fields: Record<string, string>,
    done: string,
  ) =>
    run(async () => {
      const body = new FormData();
      body.set("profile", profile);
      for (const [key, value] of Object.entries(fields)) body.set(key, value);
      const result = await action(body);
      return result.ok ? { tone: "done", text: done } : { tone: "error", text: firstError(result) };
    });

  const remove = (image: ProfileImage, label: string) => {
    if (!window.confirm(`Remove this ${label}?`)) return;
    send(removeProfileImageAction, { id: image.id }, `The ${label} is removed.`);
  };

  return (
    <div className="grid gap-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <div>
            <h3 className="font-semibold">Logo</h3>
            <p className="text-sm text-muted">Square works best. A PNG keeps a clear background.</p>
          </div>
          <ProfileLogo name={name} logo={logo} size={112} />
          <div className="flex flex-wrap gap-2">
            <Picker
              label={logo ? "Change logo" : "Add logo"}
              disabled={pending}
              onPick={(files) => upload("logo", files)}
            />
            {logo ? (
              <button
                type="button"
                className={smallButton}
                disabled={pending}
                onClick={() => remove(logo, "logo")}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid content-start gap-3">
          <div>
            <h3 className="font-semibold">Cover photo</h3>
            <p className="text-sm text-muted">
              A wide photo of your ground or team, shown across the top of your page and on your
              card.
            </p>
          </div>
          <ProfileCover cover={cover} size="small" className="aspect-[3/1] rounded-2xl" />
          <div className="flex flex-wrap gap-2">
            <Picker
              label={cover ? "Change cover" : "Add cover photo"}
              disabled={pending}
              onPick={(files) => upload("cover", files)}
            />
            {cover ? (
              <button
                type="button"
                className={smallButton}
                disabled={pending}
                onClick={() => remove(cover, "cover photo")}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <h3 className="font-semibold">
            Photos ({photos.length} of {MAX_PHOTOS})
          </h3>
          <p className="text-sm text-muted">
            Your ground, nets, coaching sessions, teams and trophies. The first ones show first.
          </p>
        </div>
        {photos.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, at) => (
              <li
                key={photo.id}
                className="grid gap-2 rounded-2xl border border-line bg-surface p-3"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                  <Image
                    src={imageSrc(photo, "small")}
                    alt={photo.caption || `Photo ${at + 1}`}
                    fill
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <form
                  className="flex gap-2"
                  action={(body) =>
                    send(
                      captionProfileImageAction,
                      { id: photo.id, caption: String(body.get("caption") ?? "") },
                      "Caption saved.",
                    )
                  }
                >
                  <label className="sr-only" htmlFor={`caption-${photo.id}`}>
                    Caption for photo {at + 1}
                  </label>
                  <input
                    id={`caption-${photo.id}`}
                    className="field min-w-0 flex-1"
                    name="caption"
                    maxLength={MAX_CAPTION}
                    defaultValue={photo.caption ?? ""}
                    placeholder="Caption, optional"
                  />
                  <button className={smallButton} disabled={pending}>
                    Save
                  </button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={smallButton}
                    disabled={pending || at === 0}
                    onClick={() =>
                      send(moveProfileImageAction, { id: photo.id, direction: "-1" }, "Moved.")
                    }
                  >
                    <ArrowLeft aria-hidden="true" size={16} />
                    <span className="sr-only">Move photo {at + 1} earlier</span>
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    disabled={pending || at === photos.length - 1}
                    onClick={() =>
                      send(moveProfileImageAction, { id: photo.id, direction: "1" }, "Moved.")
                    }
                  >
                    <ArrowRight aria-hidden="true" size={16} />
                    <span className="sr-only">Move photo {at + 1} later</span>
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    disabled={pending}
                    onClick={() => remove(photo, "photo")}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length < MAX_PHOTOS ? (
          <div>
            <Picker
              label={photos.length ? "Add more photos" : "Add photos"}
              multiple
              disabled={pending}
              onPick={(files) => upload("photo", files)}
            />
          </div>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {progress ? (
          <span className="font-medium">{progress}</span>
        ) : message ? (
          <span className={message.tone === "error" ? "text-danger" : "font-medium"}>
            {message.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** A button that opens the phone's photos or camera, or the computer's files. */
function Picker({
  label,
  multiple = false,
  disabled,
  onPick,
}: {
  label: string;
  multiple?: boolean;
  disabled: boolean;
  onPick: (files: File[]) => void;
}) {
  return (
    <label className={pickButton}>
      {label}
      <input
        type="file"
        // image/* lets iPhones turn HEIC photos into JPEG as they are picked.
        accept="image/*"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onPick(files);
        }}
      />
    </label>
  );
}
