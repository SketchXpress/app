import { create } from "zustand";
import { Editor, TLShapeId } from "tldraw";

interface CanvasState {
  editor: Editor | null;
  activeTool: string;
  selectedShapeIds: TLShapeId[];

  setEditor: (editor: Editor | null) => void;
  setActiveTool: (tool: string) => void;
  setSelectedShapeIds: (ids: TLShapeId[]) => void;

  clearCanvas: () => void;
  undoAction: () => void;
  redoAction: () => void;
  deleteSelected: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  editor: null,
  activeTool: "select",
  selectedShapeIds: [],

  setEditor: (editor) => set({ editor }),

  setActiveTool: (tool) => {
    const { editor } = get();
    if (editor) editor.setCurrentTool(tool);
    set({ activeTool: tool });
  },

  setSelectedShapeIds: (ids) => set({ selectedShapeIds: ids }),

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
    }
  },

  redoAction: () => {
    const editor = get().editor;
    if (editor) {
      editor.redo();
    }
  },

  deleteSelected: () => {
    const { editor, selectedShapeIds } = get();
    if (editor && selectedShapeIds.length > 0) {
      editor.deleteShapes(selectedShapeIds);
    }
  },
}));
