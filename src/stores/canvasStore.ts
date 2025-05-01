import { create } from "zustand";
import { Editor, TLShapeId } from "tldraw";

interface CanvasState {
  editor: Editor | null;
  activeTool: string;
  selectedShapeIds: TLShapeId[];
  lastAction: string;

  setEditor: (editor: Editor | null) => void;
  setActiveTool: (tool: string) => void;
  setSelectedShapeIds: (ids: TLShapeId[]) => void;
  setLastAction: (action: string) => void;

  clearCanvas: () => void;
  undoAction: () => void;
  redoAction: () => void;
  deleteSelected: () => void;
}

interface CanvasState {
  editor: Editor | null;
  activeTool: string;
  selectedShapeIds: TLShapeId[];
  lastAction: string; // NEW

  setEditor: (editor: Editor | null) => void;
  setActiveTool: (tool: string) => void;
  setSelectedShapeIds: (ids: TLShapeId[]) => void;
  setLastAction: (action: string) => void; // NEW

  clearCanvas: () => void;
  undoAction: () => void;
  redoAction: () => void;
  deleteSelected: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  editor: null,
  activeTool: "draw",
  selectedShapeIds: [],
  lastAction: "draw", // default to draw

  setEditor: (editor) => set({ editor }),

  setActiveTool: (tool) => {
    const { editor } = get();
    if (editor) editor.setCurrentTool(tool);
    set({ activeTool: tool, lastAction: tool });
  },

  setSelectedShapeIds: (ids) => set({ selectedShapeIds: ids }),
  setLastAction: (action) => set({ lastAction: action }),

  clearCanvas: () => {
    const { editor } = get();
    if (editor) {
      const allShapeIds = editor.getCurrentPageShapes().map((s) => s.id);
      if (allShapeIds.length) editor.deleteShapes(allShapeIds);
    }
  },

  undoAction: () => {
    const editor = get().editor;
    if (editor) {
      editor.undo();
      set({ lastAction: "undo" });
    }
  },

  redoAction: () => {
    const editor = get().editor;
    if (editor) {
      editor.redo();
      set({ lastAction: "redo" });
    }
  },

  deleteSelected: () => {
    const { editor, selectedShapeIds } = get();
    if (editor && selectedShapeIds.length > 0) {
      editor.deleteShapes(selectedShapeIds);
    }
  },
}));
