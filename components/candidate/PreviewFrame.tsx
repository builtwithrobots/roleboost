'use client';

import { useEffect, useState, type ElementType } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  RefreshCw,
  ExternalLink,
  EyeOff,
  Wifi,
} from 'lucide-react';

type DeviceKey = 'desktop' | 'tablet' | 'phone';

interface DeviceConfig {
  label: string;
  Icon: ElementType;
  /** Natural portrait viewport in CSS px. `null` = fill the stage (desktop). */
  width: number | null;
  height: number | null;
}

// Real device widths so the calling card's viewport breakpoints fire honestly
// inside the iframe: the tablet stays two-column, the phone stacks.
const DEVICES: Record<DeviceKey, DeviceConfig> = {
  desktop: { label: 'Desktop', Icon: Monitor, width: null, height: null },
  tablet: { label: 'Tablet', Icon: Tablet, width: 820, height: 1180 },
  phone: { label: 'Phone', Icon: Smartphone, width: 390, height: 844 },
};

/** Live clock for the simulated device status bar. Starts at Apple's classic
 *  9:41 for the server render, then syncs to the viewer's real time on mount. */
function useDeviceClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function SignalBars() {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {[4, 6, 8, 10].map((h) => (
        <span key={h} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />
      ))}
    </span>
  );
}

function BatteryIcon() {
  return (
    <span className="flex items-center" aria-hidden="true">
      <span className="flex h-[11px] w-[22px] items-center rounded-[3px] border border-current p-[1.5px] opacity-90">
        <span className="h-full w-[82%] rounded-[1px] bg-current" />
      </span>
      <span className="ml-[1px] h-1 w-[2px] rounded-r-[1px] bg-current opacity-90" />
    </span>
  );
}

/** iOS/iPadOS-style status bar rendered inside the device bezel, above the
 *  screen content, so the preview reads as a real phone or tablet. */
function DeviceStatusBar({ device, rotated }: { device: DeviceKey; rotated: boolean }) {
  const now = useDeviceClock();
  const isPhone = device === 'phone';

  const time = now
    ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '9:41 AM';
  const date = now
    ? now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Mon Jul 7';

  return (
    <div
      aria-hidden="true"
      className="relative flex h-9 shrink-0 select-none items-center justify-between bg-[var(--rb-bg-page)] px-5 text-[13px] font-semibold text-neutral-800"
    >
      <span className="flex items-baseline gap-2 tracking-tight">
        <span className="font-data">{time}</span>
        {!isPhone && <span className="text-xs font-medium text-neutral-500">{date}</span>}
      </span>

      {/* Dynamic-island pill on the phone in portrait. */}
      {isPhone && !rotated && (
        <span className="absolute left-1/2 top-1/2 h-[22px] w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900" />
      )}

      <span className="flex items-center gap-1.5">
        <SignalBars />
        <Wifi className="size-4" strokeWidth={2.5} />
        {!isPhone && <span className="text-xs font-medium">100%</span>}
        <BatteryIcon />
      </span>
    </div>
  );
}

interface Props {
  /** Same-origin, owner-only route that renders the real calling card. */
  previewUrl: string;
  /** The public profile URL, opened in a new tab when published. */
  liveUrl: string;
  slug: string;
  isPublished: boolean;
}

export default function PreviewFrame({ previewUrl, liveUrl, slug, isPublished }: Props) {
  const [device, setDevice] = useState<DeviceKey>('desktop');
  const [rotated, setRotated] = useState(false);
  // Remount the iframe to reload it (fresh chat, freshly signed asset URLs).
  const [reloadKey, setReloadKey] = useState(0);

  const cfg = DEVICES[device];
  const isDesktop = device === 'desktop';
  const rotatable = !isDesktop;

  // Swap width/height when rotated (portrait <-> landscape).
  const width = rotatable && rotated ? cfg.height : cfg.width;
  const height = rotatable && rotated ? cfg.width : cfg.height;

  function selectDevice(key: DeviceKey) {
    setDevice(key);
    if (key === 'desktop') setRotated(false);
  }

  const iframe = (
    <iframe
      key={reloadKey}
      src={previewUrl}
      title="Your profile as employers see it"
      className="size-full border-0 bg-[var(--rb-bg-page)]"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: publish status */}
        <div className="flex items-center gap-2">
          {isPublished ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
            >
              <ExternalLink className="size-3.5" />
              Open live page
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-amber-200 bg-[var(--color-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--color-warning)]">
              <EyeOff className="size-3.5" />
              Draft, only you can see this
            </span>
          )}
        </div>

        {/* Center: device segmented control */}
        <div
          role="radiogroup"
          aria-label="Preview device"
          className="inline-flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] p-1"
        >
          {(Object.keys(DEVICES) as DeviceKey[]).map((key) => {
            const { label, Icon } = DEVICES[key];
            const active = device === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectDevice(key)}
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--duration-fast)] ${
                  active
                    ? 'bg-[var(--rb-brand)] text-white shadow-[var(--shadow-card)]'
                    : 'text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]'
                }`}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: rotate + reload */}
        <div className="flex items-center gap-1">
          {rotatable && (
            <button
              type="button"
              onClick={() => setRotated((r) => !r)}
              aria-label="Rotate device"
              aria-pressed={rotated}
              className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] text-[var(--rb-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
            >
              <RotateCw className={`size-4 transition-transform ${rotated ? 'rotate-90' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Reload preview"
            className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] text-[var(--rb-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex h-[72svh] min-h-[540px] items-center justify-center overflow-auto rounded-[var(--radius-2xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-sunken)] p-4 sm:p-6">
        <div className="rb-dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

        {isDesktop ? (
          // A browser-window chrome for the desktop view.
          <div className="relative flex size-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] shadow-[var(--shadow-lg,0_20px_50px_-20px_rgba(0,0,0,0.35))]">
            <div className="flex items-center gap-2 border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
              </span>
              <div className="mx-auto max-w-xs flex-1 truncate rounded-full bg-[var(--rb-bg-surface-sunken)] px-3 py-1 text-center text-xs text-[var(--rb-text-muted)] font-data">
                roleboost.app/c/{slug}
              </div>
            </div>
            <div className="min-h-0 flex-1">{iframe}</div>
          </div>
        ) : (
          // A device bezel for tablet / phone.
          <div
            className="relative max-h-full max-w-full overflow-hidden rounded-[2.25rem] border-[6px] border-neutral-800 bg-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)]"
            style={{ width: width ?? undefined, height: height ?? undefined }}
          >
            <div className="flex size-full flex-col overflow-hidden rounded-[1.85rem] bg-[var(--rb-bg-page)]">
              <DeviceStatusBar device={device} rotated={rotated} />
              <div className="min-h-0 flex-1">{iframe}</div>
            </div>
          </div>
        )}
      </div>

      {/* Dimension readout */}
      <p className="text-center text-xs text-[var(--rb-text-muted)]">
        {isDesktop
          ? 'Responsive, fills the browser'
          : `${width} × ${height} px${rotated ? ' · landscape' : ''}`}
      </p>
    </div>
  );
}
