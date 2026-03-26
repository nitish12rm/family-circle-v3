function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } | null {
  // https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{ext}
  const match = url.match(/cloudinary\.com\/[^/]+\/([^/]+)\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  if (!match) return null;
  return { resourceType: match[1], publicId: match[2] };
}

export async function deleteFromCloudinary(url: string): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret || !url) return;

  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return;

  const { publicId, resourceType } = parsed;
  const timestamp = Math.floor(Date.now() / 1000);
  const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp.toString());
  form.append("signature", signature);

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  });
}

export async function deleteAllFromCloudinary(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.filter(Boolean).map(deleteFromCloudinary));
}
