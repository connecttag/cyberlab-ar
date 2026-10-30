import jsQR from "jsqr";
self.onmessage = async ({ data }: { data: { file: File } }) => {
  try {
    const file = data.file;
    if (
      file.size > 10 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      throw new Error("INVALID_IMAGE");
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 16_000_000) {
      bitmap.close();
      throw new Error("IMAGE_TOO_LARGE");
    }
    const width = bitmap.width,
      height = bitmap.height,
      canvas = new OffscreenCanvas(width, height),
      context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw new Error("QR_UNAVAILABLE");
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, width, height);
    const qr = jsQR(pixels.data, width, height, {
      inversionAttempts: "attemptBoth"
    });
    if (!qr) throw new Error("QR_NOT_FOUND");
    self.postMessage({ text: qr.data.slice(0, 32768) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "QR_UNAVAILABLE"
    });
  }
};
