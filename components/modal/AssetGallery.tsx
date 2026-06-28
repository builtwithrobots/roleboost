'use client';

import { useState, type ElementType } from 'react';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import {
  Headphones,
  MessageSquare,
  Video,
  Layout,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  Maximize2,
  Play,
  X,
} from 'lucide-react';
import AudioPlayer from './AudioPlayer';

type AssetType = 'audio' | 'debate_audio' | 'video' | 'deck' | 'infographic' | 'resume';

interface Asset {
  asset_type: AssetType;
  file_name: string;
  signed_url: string;
}

interface Props {
  firstName: string;
  assets: Asset[];
  /** Fill the parent height (the calling card's right column). */
  fill?: boolean;
}

const TAB_CONFIG: Record<AssetType, { label: string; Icon: ElementType }> = {
  resume: { label: 'Résumé', Icon: FileText },
  infographic: { label: 'Infographic', Icon: ImageIcon },
  audio: { label: 'Audio overview', Icon: Headphones },
  debate_audio: { label: 'Debate audio', Icon: MessageSquare },
  video: { label: 'Video', Icon: Video },
  deck: { label: 'Slide deck', Icon: Layout },
};

// Résumé and deck read well inline next to the chat; the rest open full-size in a
// modal (infographic to view large, audio/video to play direct).
const INLINE_TYPES: AssetType[] = ['resume', 'deck'];
const ORDER: AssetType[] = ['resume', 'infographic', 'audio', 'debate_audio', 'video', 'deck'];

const isInline = (t: AssetType) => INLINE_TYPES.includes(t);

export default function AssetGallery({ firstName, assets, fill = false }: Props) {
  const available = ORDER.filter((t) => assets.some((a) => a.asset_type === t));
  const [active, setActive] = useState<AssetType | null>(available[0] ?? null);
  const [modalOpen, setModalOpen] = useState(false);

  if (available.length === 0) return null;
  const asset = assets.find((a) => a.asset_type === active);

  function choose(next: AssetType) {
    setActive(next);
    // Selecting a modal-type asset opens it straight away.
    setModalOpen(!isInline(next));
  }

  return (
    <div className={fill ? 'flex h-full min-h-0 flex-col gap-3' : 'mx-auto flex max-w-3xl flex-col gap-3 px-6'}>
      {/* Selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="asset-select" className="sr-only">
          Choose what to view
        </label>
        <div className="relative flex-1">
          <select
            id="asset-select"
            value={active ?? ''}
            onChange={(e) => choose(e.target.value as AssetType)}
            className="w-full appearance-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] py-2 pl-3 pr-9 text-sm font-medium text-[var(--rb-text)] outline-none focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30"
          >
            {available.map((t) => (
              <option key={t} value={t}>
                {TAB_CONFIG[t].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--rb-text-muted)]" />
        </div>
      </div>

      {/* Viewer */}
      <div className={fill ? 'min-h-0 flex-1' : ''}>
        {asset && active && isInline(active) ? (
          <div className={`rb-card overflow-hidden ${fill ? 'h-full' : ''}`}>
            <iframe
              src={asset.signed_url}
              title={asset.file_name}
              className="w-full"
              style={fill ? { height: '100%' } : { height: '70vh' }}
            />
          </div>
        ) : asset && active ? (
          <ModalLauncher type={active} firstName={firstName} onOpen={() => setModalOpen(true)} fill={fill} />
        ) : null}
      </div>

      {/* Full-size modal for infographic / audio / video */}
      {asset && active && !isInline(active) && (
        <AssetModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          type={active}
          asset={asset}
          firstName={firstName}
        />
      )}
    </div>
  );
}

function ModalLauncher({
  type,
  firstName,
  onOpen,
  fill,
}: {
  type: AssetType;
  firstName: string;
  onOpen: () => void;
  fill: boolean;
}) {
  const { label, Icon } = TAB_CONFIG[type];
  const isAudioOrVideo = type === 'audio' || type === 'debate_audio' || type === 'video';
  return (
    <button
      onClick={onOpen}
      className={`rb-card flex w-full flex-col items-center justify-center gap-3 p-8 text-center transition-colors hover:border-[var(--rb-border-strong)] ${
        fill ? 'h-full' : ''
      }`}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
        <Icon className="size-5 text-[var(--rb-brand)]" />
      </span>
      <span className="text-sm font-semibold text-[var(--rb-text)]">{label}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white">
        {isAudioOrVideo ? <Play className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        {isAudioOrVideo ? `Play ${firstName}'s ${label.toLowerCase()}` : `View full size`}
      </span>
    </button>
  );
}

function AssetModal({
  open,
  onClose,
  type,
  asset,
  firstName,
}: {
  open: boolean;
  onClose: () => void;
  type: AssetType;
  asset: Asset;
  firstName: string;
}) {
  const isAudio = type === 'audio' || type === 'debate_audio';
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[var(--z-modal)]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[var(--rb-scrim)] backdrop-blur-sm transition duration-[var(--duration-base)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-8">
        <DialogPanel
          transition
          className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--rb-bg-surface)] shadow-[var(--shadow-modal)] transition duration-[var(--duration-base)] data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-[var(--rb-border)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--rb-text)]">{TAB_CONFIG[type].label}</span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-text)]"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {isAudio && (
              <div className="w-full max-w-md">
                <AudioPlayer src={asset.signed_url} title={asset.file_name} />
              </div>
            )}
            {type === 'video' && (
              <video src={asset.signed_url} controls autoPlay className="max-h-[78vh] w-full" aria-label={`${firstName}'s career video`} />
            )}
            {type === 'infographic' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.signed_url} alt={`${firstName}'s career infographic`} className="max-h-[78vh] w-full object-contain" />
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
