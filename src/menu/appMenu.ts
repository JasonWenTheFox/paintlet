import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { invoke } from "@tauri-apps/api/core";
import * as A from "../actions";
import { translator, type Locale } from "../i18n";

// Build the native macOS menu bar in JS. Each item's `action` calls straight
// into the shared command layer, so no Rust round-trip is needed. This is the
// natural Mac home for File/Edit/Image/View and gives real ⌘-accelerators.
//
// Note on shortcuts: menu accelerators are app-global on macOS. Single-key tool
// shortcuts (P/B/E/…) are therefore handled in a keydown listener instead — as
// menu accelerators they'd hijack every keystroke in the text editor.

const item = (
  text: string,
  accelerator: string | undefined,
  action: () => void,
) => MenuItem.new({ text, accelerator, action });

const sep = () => PredefinedMenuItem.new({ item: "Separator" });

let installQueue = Promise.resolve();

export function installAppMenu(locale: Locale): Promise<void> {
  installQueue = installQueue.catch(() => {}).then(() => buildAppMenu(locale));
  return installQueue;
}

async function buildAppMenu(locale: Locale): Promise<void> {
  const t = translator(locale);
  // Deliberately minimal: About + Quit. The default Hide / Hide Others / Show
  // All items are dropped — they're clutter for a single-window paint app.
  const appMenu = await Submenu.new({
    text: "Paintlet",
    items: [
      await item(t("menu.about"), undefined, A.openAboutWindow),
      await sep(),
      await item(t("menu.settings"), "CmdOrCtrl+,", A.openSettingsDialog),
      await sep(),
      await PredefinedMenuItem.new({ item: "Quit", text: t("menu.quit") }),
    ],
  });

  const fileMenu = await Submenu.new({
    text: t("menu.file"),
    items: [
      await item(t("menu.new"), "CmdOrCtrl+N", A.newDocument),
      await item(t("menu.open"), "CmdOrCtrl+O", A.openFile),
      await sep(),
      await item(t("menu.save"), "CmdOrCtrl+S", A.saveFile),
      await item(t("menu.saveAs"), "CmdOrCtrl+Shift+S", A.saveFileAs),
      await sep(),
      await PredefinedMenuItem.new({ item: "CloseWindow", text: t("menu.closeWindow") }),
    ],
  });

  // Edit holds the clipboard/selection commands and, folded in below, the image
  // operations (there's no separate Image menu — those commands live here).
  const editMenu = await Submenu.new({
    text: t("menu.edit"),
    items: [
      await item(t("menu.undo"), "CmdOrCtrl+Z", A.undo),
      await item(t("menu.redo"), "CmdOrCtrl+Shift+Z", A.redo),
      await sep(),
      await item(t("menu.cut"), "CmdOrCtrl+X", A.cut),
      await item(t("menu.copy"), "CmdOrCtrl+C", A.copy),
      await item(t("menu.paste"), "CmdOrCtrl+V", A.paste),
      await item(t("menu.delete"), undefined, A.deleteSelection),
      await sep(),
      await item(t("menu.selectAll"), "CmdOrCtrl+A", A.selectAll),
      await sep(),
      await item(t("menu.resize"), undefined, A.openResizeDialog),
      await item(t("menu.crop"), undefined, A.crop),
      await sep(),
      await item(t("menu.flipHorizontal"), undefined, A.flipHorizontal),
      await item(t("menu.flipVertical"), undefined, A.flipVertical),
      await item(t("menu.rotateRight"), undefined, A.rotateRight),
      await item(t("menu.rotateLeft"), undefined, A.rotateLeft),
      await item(t("menu.rotate180"), undefined, A.rotate180),
    ],
  });

  const viewMenu = await Submenu.new({
    text: t("menu.view"),
    items: [
      await item(t("menu.zoomIn"), undefined, A.zoomIn),
      await item(t("menu.zoomOut"), undefined, A.zoomOut),
      await item(t("menu.actualSize"), undefined, A.actualSize),
      await item(t("menu.fitToWindow"), undefined, A.fitToWindow),
    ],
  });

  const menu = await Menu.new({
    items: [appMenu, fileMenu, editMenu, viewMenu],
  });
  await menu.setAsAppMenu();

  // macOS injects "Writing Tools" / "AutoFill" into any menu titled "Edit"
  // when it becomes the main menu; there's no defaults switch for them (unlike
  // Dictation/Emoji, suppressed at startup on the Rust side). Strip them now
  // that the menu is installed.
  await invoke("strip_edit_menu_system_items", { editMenuTitle: t("menu.edit") });
  await invoke("set_about_window_title", { title: t("about.windowTitle") });
}
