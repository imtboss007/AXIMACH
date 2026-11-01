export type FileSaveResult = "download-started" | "shared" | "cancelled";

/** Mobile-aware file save helper. Keeps Blob URLs alive for slower download managers. */
export async function saveBlobFile(filename: string, blob: Blob): Promise<FileSaveResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("File downloads are available only in the browser.");
  }
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const shareNavigator = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (mobile && typeof File !== "undefined" && shareNavigator.share && shareNavigator.canShare) {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    if (shareNavigator.canShare({ files: [file] })) {
      try {
        await shareNavigator.share({ files: [file], title: filename });
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      }
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.position = "fixed";
  anchor.style.left = "-10000px";
  document.body.appendChild(anchor);
  try {
    if ("download" in anchor) anchor.click();
    else {
      const opened = window.open(objectUrl, "_blank", "noopener");
      if (!opened) throw new Error("This browser blocked the file download.");
    }
  } finally {
    anchor.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return "download-started";
}
