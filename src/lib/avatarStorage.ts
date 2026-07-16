import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export class InvalidAvatarError extends Error {
  code: "invalid-type" | "too-large";

  constructor(code: "invalid-type" | "too-large", message: string) {
    super(message);
    this.code = code;
  }
}

export async function uploadAvatar(file: File, ownerKey: string): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new InvalidAvatarError("invalid-type", `Unsupported avatar type: ${file.type}`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new InvalidAvatarError("too-large", `Avatar exceeds ${MAX_SIZE_BYTES} bytes`);
  }

  const token = import.meta.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Missing BLOB_READ_WRITE_TOKEN environment variable");

  const extension = file.type.split("/")[1];
  const pathname = `avatars/${ownerKey}-${Date.now()}.${extension}`;

  const blob = await put(pathname, file, {
    access: "public",
    token,
    contentType: file.type,
  });

  return blob.url;
}
