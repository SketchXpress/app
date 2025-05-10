import { AssetRecordType } from "@tldraw/tldraw";
import { useCanvasStore } from "@/stores/canvasStore";

// Function to handle the upload of an image
export const handleUploadArt = () => {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.click();

  fileInput.onchange = (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const editor = useCanvasStore.getState().editor;
    if (!editor) return;

    const assetId = AssetRecordType.createId();
    const reader = new FileReader();

    reader.onload = () => {
      const base64DataUrl = reader.result as string;
      const image = new window.Image();

      image.onload = () => {
        const { width, height } = image;

        editor.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: file.name,
              src: base64DataUrl,
              w: width,
              h: height,
              mimeType: file.type,
              isAnimated: false,
            },
            meta: {},
          },
        ]);

        editor.createShape({
          type: "image",
          x: (window.innerWidth - width) / 2,
          y: (window.innerHeight - height) / 2,
          props: {
            assetId,
            w: width,
            h: height,
          },
        });
      };

      image.src = base64DataUrl;
    };

    reader.readAsDataURL(file);
  };
};

// Function to handle the use of an example image
export const handleUseExample = (example: {
  id: number;
  title: string;
  thumbnail: string;
}) => {
  const editor = useCanvasStore.getState().editor;
  if (!editor) return;

  const assetId = AssetRecordType.createId();
  const image = new window.Image();

  image.crossOrigin = "anonymous";
  image.onload = () => {
    const { width, height } = image;

    const base64DataUrl = getBase64FromImage(image);

    base64DataUrl.then((src) => {
      editor.createAssets([
        {
          id: assetId,
          type: "image",
          typeName: "asset",
          props: {
            name: example.title,
            src,
            w: width,
            h: height,
            mimeType: "image/png",
            isAnimated: false,
          },
          meta: {},
        },
      ]);

      editor.createShape({
        type: "image",
        x: (window.innerWidth - width) / 2,
        y: (window.innerHeight - height) / 2,
        props: {
          assetId,
          w: width,
          h: height,
        },
      });
    });
  };

  image.src = example.thumbnail;
};

// Helper to convert Image object to base64
export const getBase64FromImage = (img: HTMLImageElement): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0);
    resolve(canvas.toDataURL("image/png"));
  });
};
