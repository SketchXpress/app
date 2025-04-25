import { Editor } from "@tldraw/tldraw";

export function extractPromptFromSelection(editor: Editor): string {
  const shapeIds = editor.getSelectedShapeIds();
  const shapes = shapeIds.map((id) => editor.getShape(id)).filter(Boolean);

  const texts: string[] = [];

  for (const shape of shapes) {
    const props = shape?.props as { text?: string };
    if (typeof props.text === "string" && props.text.trim().length > 0) {
      texts.push(props.text.trim());
    }
  }

  return texts.join("\n");
}
