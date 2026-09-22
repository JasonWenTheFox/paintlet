import type { ReactNode } from "react";
import { engine, usePaintStore } from "../state/store";
import { isFreehandTool, isImplemented, isShapeTool } from "../tools/registry";
import type { ToolId } from "../engine/types";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";
import { ToolButton } from "./ToolButton";
import { ColorControls } from "./ColorControls";
import { TextOptions } from "./TextOptions";
import type { TranslationKey } from "../i18n";
import { useTranslation } from "../hooks/useTranslation";

// `key` is the tool's shortcut letter, present only for the tools Windows Paint
// gives one (see TOOL_KEYS in App.tsx); the rest are mouse-only there and here.
type ToolDef = {
  id: ToolId;
  icon: IconName;
  labelKey: TranslationKey;
  key?: string;
};

const SELECT_TOOLS: ToolDef[] = [
  { id: "select", icon: "select", labelKey: "toolbar.tool.select", key: "S" },
  { id: "freeSelect", icon: "lasso", labelKey: "toolbar.tool.freeSelect" },
];

// Drawing tools laid out to fill two rows (Win11 Paint's compact Tools group).
const DRAW_TOOLS: ToolDef[] = [
  { id: "pencil", icon: "pencil", labelKey: "toolbar.tool.pencil", key: "P" },
  { id: "brush", icon: "brush", labelKey: "toolbar.tool.brush" },
  { id: "fill", icon: "fill", labelKey: "toolbar.tool.fill", key: "B" },
  { id: "text", icon: "text", labelKey: "toolbar.tool.text", key: "T" },
  { id: "eraser", icon: "eraser", labelKey: "toolbar.tool.eraser", key: "E" },
  { id: "eyedropper", icon: "eyedropper", labelKey: "toolbar.tool.eyedropper", key: "I" },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: "line", icon: "line", labelKey: "toolbar.tool.line" },
  { id: "curve", icon: "curve", labelKey: "toolbar.tool.curve" },
  { id: "rectangle", icon: "rectangle", labelKey: "toolbar.tool.rectangle" },
  { id: "roundedRectangle", icon: "roundedRectangle", labelKey: "toolbar.tool.roundedRectangle" },
  { id: "ellipse", icon: "ellipse", labelKey: "toolbar.tool.ellipse" },
  { id: "polygon", icon: "polygon", labelKey: "toolbar.tool.polygon" },
];

// Shapes draw at one of a few fixed widths (not the continuous pencil slider).
const SHAPE_SIZES = [1, 3, 5, 8];

// A labeled ribbon group: content on top, a small caption underneath — the
// Win11 Paint layout the user asked to get closer to.
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1.5">
      <div className="flex flex-1 items-center">{children}</div>
      <span className="text-[10px] leading-none text-ink-muted">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 w-px self-stretch bg-hairline" />;
}

// A compact tool block that fills two rows before starting a new column, so a
// set of tool buttons stays tight instead of sprawling across one long row.
function ToolGrid({ tools }: { tools: ToolDef[] }) {
  const t = useTranslation();
  const activeToolId = usePaintStore((s) => s.activeToolId);
  const setTool = usePaintStore((s) => s.setTool);
  return (
    <div className="grid grid-flow-col grid-rows-2 gap-0.5">
      {tools.map((tool) => {
        const enabled = isImplemented(tool.id);
        const label = t(tool.labelKey);
        return (
          <ToolButton
            key={tool.id}
            title={
              !enabled
                ? t("toolbar.tool.comingSoon", { tool: label })
                : tool.key
                  ? t("toolbar.tool.shortcut", { tool: label, key: tool.key })
                  : label
            }
            active={activeToolId === tool.id}
            disabled={!enabled}
            onClick={() => setTool(tool.id)}
          >
            <Icon name={tool.icon} />
          </ToolButton>
        );
      })}
    </div>
  );
}

// A continuous stroke-width slider for the freehand tools (pencil / brush /
// eraser). Shapes use the discrete picker below instead.
function SizeSlider() {
  const brushSize = usePaintStore((s) => s.brushSize);
  const setBrushSize = usePaintStore((s) => s.setBrushSize);
  return (
    <div className="flex items-center gap-2 px-1">
      <input
        type="range"
        min={1}
        max={64}
        step={1}
        value={brushSize}
        onChange={(e) => setBrushSize(Number(e.target.value))}
        className="w-28 accent-[var(--vp-accent)]"
        title={`${brushSize}px`}
      />
      <span className="w-8 text-right text-xs tabular-nums text-ink-muted">
        {brushSize}px
      </span>
    </div>
  );
}

// Discrete stroke-width picker shown while a shape tool is active.
function ShapeSizePicker() {
  const shapeSize = usePaintStore((s) => s.shapeSize);
  const setShapeSize = usePaintStore((s) => s.setShapeSize);
  return (
    <div className="flex items-center gap-0.5">
      {SHAPE_SIZES.map((n) => (
        <button
          key={n}
          type="button"
          title={`${n}px`}
          onClick={() => setShapeSize(n)}
          className={cx(
            "h-7 w-8 rounded-md text-xs tabular-nums",
            shapeSize === n
              ? "bg-[var(--vp-accent)] text-white"
              : "text-ink-muted hover:bg-hover",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// The contextual group between Shapes and Colors: text styling for the Text
// tool, the fixed-width picker for shapes, the continuous slider for freehand
// strokes, and nothing for tools with no size (select/lasso/fill/eyedropper).
function ContextGroup() {
  const t = useTranslation();
  const activeToolId = usePaintStore((s) => s.activeToolId);
  if (activeToolId === "text")
    return (
      <>
        <Divider />
        <Group label={t("toolbar.group.text")}>
          <TextOptions />
        </Group>
      </>
    );
  if (isShapeTool(activeToolId))
    return (
      <>
        <Divider />
        <Group label={t("toolbar.group.size")}>
          <ShapeSizePicker />
        </Group>
      </>
    );
  if (isFreehandTool(activeToolId))
    return (
      <>
        <Divider />
        <Group label={t("toolbar.group.size")}>
          <SizeSlider />
        </Group>
      </>
    );
  return null;
}

export function Toolbar() {
  const t = useTranslation();
  const canUndo = usePaintStore((s) => s.canUndo);
  const canRedo = usePaintStore((s) => s.canRedo);

  return (
    <div className="flex shrink-0 items-stretch gap-1 border-b border-hairline bg-surface px-2 py-1.5">
      <Group label={t("toolbar.group.history")}>
        <ToolButton title={t("toolbar.undo")} disabled={!canUndo} onClick={() => engine.undo()}>
          <Icon name="undo" />
        </ToolButton>
        <ToolButton title={t("toolbar.redo")} disabled={!canRedo} onClick={() => engine.redo()}>
          <Icon name="redo" />
        </ToolButton>
      </Group>

      <Divider />
      <Group label={t("toolbar.group.select")}>
        <ToolGrid tools={SELECT_TOOLS} />
      </Group>

      <Divider />
      <Group label={t("toolbar.group.tools")}>
        <ToolGrid tools={DRAW_TOOLS} />
      </Group>

      <Divider />
      <Group label={t("toolbar.group.shapes")}>
        <ToolGrid tools={SHAPE_TOOLS} />
      </Group>

      <ContextGroup />

      {/* Colors, pushed to the right. */}
      <div className="ml-auto flex items-stretch">
        <Divider />
        <Group label={t("toolbar.group.colors")}>
          <ColorControls />
        </Group>
      </div>
    </div>
  );
}
