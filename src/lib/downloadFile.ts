export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();

  // Extract extension from the URL (strip query params first)
  const cleanUrl = url.split("?")[0];
  const urlExt = cleanUrl.match(/\.([a-zA-Z0-9]+)$/)?.[1];

  // Only append extension if the filename doesn't already have one
  const hasExt = /\.[a-zA-Z0-9]+$/.test(filename);
  const name = !hasExt && urlExt ? `${filename}.${urlExt}` : filename;

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
