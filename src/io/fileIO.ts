import { message, open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { engine, usePaintStore } from "../state/store";
import {
  OPEN_EXTS,
  SAVE_UTIS,
  canEncode,
  encodingFor,
  extOf,
  isCompleteAvifContainer,
  type Encoding,
} from "./formats";

// File → Open. Decode the chosen image and replace the whole document.
export async function openImage(): Promise<void> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Images", extensions: OPEN_EXTS }],
  });
  if (typeof selected !== "string") return;

  try {
    // Read the bytes through our Rust command (returns an ArrayBuffer) so the
    // user can open from anywhere without fs-scope restrictions.
    const raw = await invoke<ArrayBuffer>("read_image_file", { path: selected });
    const bytes = new Uint8Array(raw);
    if (extOf(selected) === "avif" && !isCompleteAvifContainer(bytes)) {
      throw new Error("Invalid or incomplete AVIF container");
    }

    // Decode before touching the engine. A malformed or unsupported file must
    // leave the current pixels, history, dirty state, and path unchanged.
    const bitmap = await createImageBitmap(new Blob([bytes]));
    try {
      engine.loadBitmap(bitmap);
    } finally {
      bitmap.close();
    }
    usePaintStore.getState().setFilePath(selected);
  } catch (err) {
    console.error("Failed to open image:", err);
    try {
      await message(
        `“${basename(selected)}” could not be opened. The file may be damaged, be in an unsupported image format, or require a newer version of macOS.`,
        { title: "Open Image", kind: "error" },
      );
    } catch (dialogErr) {
      console.error("Failed to show the open-image error dialog:", dialogErr);
    }
  }
}

// File → Save / Save As. An already-saved file re-writes in place with no
// prompt. Otherwise the save panel is shown ONCE — no extra in-app step — and
// whichever format its popup lands on decides the encoder, via the extension it
// writes into the filename.
export async function saveImage(saveAs = false): Promise<void> {
  const store = usePaintStore.getState();
  const path = store.filePath;

  // Re-write in place only when we can actually produce the format already on
  // disk. A file we can read but not write (WebP, HEIC) falls through to the
  // panel rather than being overwritten with PNG bytes under its original
  // name — that would corrupt the file instead of saving it.
  if (!saveAs && path && canEncode(path)) {
    await writeTo(path, encodingFor(path));
    return;
  }

  const chosen = await pickSavePath(path);
  if (!chosen) return; // cancelled

  // Whatever route produced the path, the extension decides the encoder — the
  // format popup works by rewriting that extension, so there's one rule here
  // and no second source of truth. Anything unencodable (or extension-less)
  // gains a .png rather than being written with mismatched bytes.
  const dest = canEncode(chosen) ? chosen : `${chosen}.png`;

  await writeTo(dest, encodingFor(dest));
}

// Ask for a destination, preferring our own panel because it's the only one
// with a format popup: NSSavePanel can show that control natively
// (`showsContentTypes`), but tauri-plugin-dialog goes through rfd, which
// flattens filters into a bare extension list and never enables it.
//
// Falls back to the plugin on any failure and on macOS 13 or older, where the
// control doesn't exist — a missing popup is worth degrading over, not
// blocking a save for.
async function pickSavePath(current: string | null): Promise<string | null> {
  const stem = current ? current.replace(/\.[^./\\]+$/, "") : "untitled";
  const name = `${basename(stem)}.png`;

  try {
    const res = await invoke<{ path: string | null; supported: boolean }>(
      "save_image_dialog",
      {
        request: {
          name,
          types: SAVE_UTIS,
          directory: current ? dirname(current) : null,
        },
      },
    );
    if (res.supported) return res.path;
  } catch (err) {
    console.error("Native save panel failed; using the plugin dialog:", err);
  }

  // The filter names here produce no popup — see above — so they serve only to
  // decide which typed extensions the panel accepts.
  return await save({
    defaultPath: `${stem}.png`,
    filters: [
      { name: "PNG image", extensions: ["png"] },
      { name: "JPEG image", extensions: ["jpg", "jpeg"] },
      { name: "BMP image", extensions: ["bmp"] },
      { name: "GIF image", extensions: ["gif"] },
    ],
  });
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

// Empty for a bare filename, which leaves the panel at its default directory.
function dirname(path: string): string | null {
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : null;
}

// Bake any floating selection in, encode the base, and write it to disk.
async function writeTo(
  path: string,
  { type, quality }: Encoding,
): Promise<void> {
  engine.deselect();
  const blob = await engine.toBlob(type, quality);
  const buf = new Uint8Array(await blob.arrayBuffer());
  await invoke("write_image_file", { path, data: Array.from(buf) });
  usePaintStore.getState().setFilePath(path);
  engine.markSaved();
}
