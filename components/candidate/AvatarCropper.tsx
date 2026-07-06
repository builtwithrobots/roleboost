'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { ZoomIn, ZoomOut } from 'lucide-react';

const OUTPUT_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders the selected crop region to a square JPEG blob. Uses the local data
 *  URL so the canvas is never tainted (no CORS). */
async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('crop failed'))), 'image/jpeg', 0.9),
  );
}

/**
 * Modal for positioning a profile photo: drag to move, slider/pinch to zoom,
 * inside a round window. "Save" exports the framed region as a square image.
 */
export default function AvatarCropper({
  src,
  open,
  onCancel,
  onSave,
}: {
  src: string;
  open: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_area: Area, px: Area) => setAreaPixels(px), []);

  async function save() {
    if (!areaPixels) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(src, areaPixels);
      await onSave(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onCancel} className="relative z-[var(--z-modal)]">
      <DialogBackdrop className="fixed inset-0 bg-[var(--rb-scrim)] backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex w-full max-w-sm flex-col rounded-[var(--radius-2xl)] bg-[var(--rb-bg-surface)] p-4 shadow-[var(--shadow-modal)]">
          <p className="mb-1 text-sm font-semibold text-[var(--rb-text)]">Position your photo</p>
          <p className="mb-3 text-xs text-[var(--rb-text-muted)]">Drag to move, use the slider to zoom, then lock it in.</p>

          <div className="relative h-64 w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--rb-bg-surface-sunken)]">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <ZoomOut className="size-4 shrink-0 text-[var(--rb-text-muted)]" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-[var(--rb-brand)]"
            />
            <ZoomIn className="size-4 shrink-0 text-[var(--rb-text-muted)]" />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-text)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !areaPixels}
              className="rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
