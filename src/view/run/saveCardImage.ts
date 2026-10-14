import { domToBlob } from 'modern-screenshot';

/** Renders a card at three times its size, measured in its own units so the canvas's scale does not enter. */
export function renderCardImage(node: HTMLElement): Promise<Blob> {
  return domToBlob(node, { width: node.offsetWidth, height: node.offsetHeight, scale: 3, type: 'image/png' });
}

/**
 * A phone gets the share sheet (Save Image, Discord, Messages in one place); anything else downloads.
 * The sheet must open close to the tap, so the blob is rendered ahead and handed in.
 */
export async function saveCardImage(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
