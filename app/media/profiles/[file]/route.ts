import { readProfileImageAsJpeg, readProfileImageFile } from "@/lib/media/store";

/**
 * Serves profile pictures from UPLOAD_DIR. Each upload gets a new random name, so a file never
 * changes and browsers may keep it for a year.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const share = file.endsWith(".jpg");
  const data = share ? await readProfileImageAsJpeg(file) : await readProfileImageFile(file);
  if (!data) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": share ? "image/jpeg" : "image/webp",
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
}
