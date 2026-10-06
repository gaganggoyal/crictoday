/**
 * Shrinks a picture in the browser before it is sent, so a 10 MB phone photo uploads as a few
 * hundred kilobytes. The server checks and re-encodes whatever arrives, so on any failure this
 * returns the original file.
 */
export async function shrinkPicture(file: File, maxEdge: number, keepTransparency: boolean) {
  const sendable = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && sendable && file.size <= 1_500_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = keepTransparency ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  if (!blob) return file;
  if (sendable && blob.size >= file.size) return file;
  return new File([blob], keepTransparency ? "picture.png" : "picture.jpg", { type });
}
