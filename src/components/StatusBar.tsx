import { usePaintStore } from "../state/store";
import type { ToolId } from "../engine/types";
import { ZOOM_MAX, ZOOM_MIN, clampZoom } from "../lib/zoom";
import type { TranslationKey } from "../i18n";
import { useTranslation } from "../hooks/useTranslation";

// A one-line usage hint for tools whose interaction isn't self-evident — the
// multi-gesture curve, the multi-click polygon, and the selection tools. Shown
// in the status bar so the behavior is discoverable without a manual.
const TOOL_HINTS: Partial<Record<ToolId, TranslationKey>> = {
  curve: "status.hint.curve",
  polygon: "status.hint.polygon",
  select: "status.hint.select",
  freeSelect: "status.hint.freeSelect",
  text: "status.hint.text",
};

// Bottom status bar: cursor coordinates, image dimensions, and a persistent
// zoom slider + percentage on the right — a signature modern-Paint element.
export function StatusBar() {
  const t = useTranslation();
  const cursorPos = usePaintStore((s) => s.cursorPos);
  const { w, h } = usePaintStore((s) => s.imageSize);
  const selectionSize = usePaintStore((s) => s.selectionSize);
  const activeToolId = usePaintStore((s) => s.activeToolId);
  const zoom = usePaintStore((s) => s.view.zoom);
  const setZoom = usePaintStore((s) => s.setZoom);
  const hintKey = TOOL_HINTS[activeToolId];

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t border-hairline bg-surface px-3 text-xs text-ink-muted">
      <span className="w-28 tabular-nums">
        {cursorPos
          ? `${Math.floor(cursorPos.x)}, ${Math.floor(cursorPos.y)} px`
          : " "}
      </span>
      <span className="tabular-nums">
        {w} × {h}px
      </span>
      {selectionSize && (
        <span className="tabular-nums">
          ⬚ {selectionSize.w} × {selectionSize.h}px
        </span>
      )}

      {hintKey && (
        <span className="min-w-0 flex-1 truncate text-ink-muted/80">{t(hintKey)}</span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          title={t("status.zoomOut")}
          onClick={() => setZoom(clampZoom(zoom - 0.25))}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-hover"
        >
          −
        </button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.25}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-32 accent-[var(--vp-accent)]"
          title={`${Math.round(zoom * 100)}%`}
        />
        <button
          type="button"
          title={t("status.zoomIn")}
          onClick={() => setZoom(clampZoom(zoom + 0.25))}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-hover"
        >
          +
        </button>
        <span className="w-10 text-right tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
