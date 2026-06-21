'use client';

import { useState } from 'react';
import { MapPin, Link2, Headphones, MessageSquare, Video, Layout, Image as ImageIcon, FileText, MessageCircle, ExternalLink } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

type AssetType = 'audio' | 'debate_audio' | 'video' | 'deck' | 'infographic' | 'resume';

interface Asset {
  asset_type: AssetType;
  file_name: string;
  signed_url: string;
}

interface Props {
  fullName: string;
  headline: string | null;
  targetRole: string | null;
  location: string | null;
  linkedinUrl: string | null;
  summaryBullets: string[];
  aiEnabled: boolean;
  assets: Asset[];
}

const TAB_CONFIG: Record<AssetType | 'chat', { label: string; Icon: React.ElementType }> = {
  audio:       { label: 'Audio',       Icon: Headphones },
  debate_audio:{ label: 'Debate',      Icon: MessageSquare },
  video:       { label: 'Video',       Icon: Video },
  deck:        { label: 'Deck',        Icon: Layout },
  infographic: { label: 'Infographic', Icon: ImageIcon },
  resume:      { label: 'Resume',      Icon: FileText },
  chat:        { label: 'Chat AI',     Icon: MessageCircle },
};

const TAB_ORDER: (AssetType | 'chat')[] = ['audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume', 'chat'];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

export default function CandidateModal({
  fullName,
  headline,
  targetRole,
  location,
  linkedinUrl,
  summaryBullets,
  aiEnabled,
  assets,
}: Props) {
  const availableAssetTypes = new Set(assets.map((a) => a.asset_type));
  const tabs = TAB_ORDER.filter(
    (t) => t === 'chat' ? aiEnabled : availableAssetTypes.has(t as AssetType)
  );
  const [activeTab, setActiveTab] = useState<AssetType | 'chat' | null>(tabs[0] ?? null);

  const getAsset = (type: AssetType) => assets.find((a) => a.asset_type === type);

  return (
    <div className="min-h-full bg-[--rb-bg-page]">
      {/* Profile card — the "above the fold" section */}
      <div className="border-b border-[--rb-border] bg-[--rb-bg-surface]">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="size-16 shrink-0 rounded-full bg-[--rb-brand] flex items-center justify-center text-white text-xl font-bold shadow-[0_4px_16px_rgb(79_70_229_/_0.25)]">
              {getInitials(fullName)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[--rb-text] leading-tight">{fullName}</h1>
              {targetRole && (
                <p className="text-base text-[--rb-text-secondary] mt-0.5">{targetRole}</p>
              )}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
                {location && (
                  <span className="flex items-center gap-1 text-sm text-[--rb-text-muted]">
                    <MapPin className="size-3.5" />
                    {location}
                  </span>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-[--rb-brand] hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Headline */}
          {headline && (
            <p className="mt-5 text-base text-[--rb-text-secondary] leading-relaxed border-l-2 border-[--rb-brand] pl-4">
              {headline}
            </p>
          )}

          {/* Career snapshot bullets */}
          {summaryBullets.length > 0 && (
            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {summaryBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[--rb-text-secondary]">
                  <span className="text-[--rb-brand] font-bold mt-0.5 shrink-0">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Asset tabs */}
        {tabs.length > 0 && (
          <div className="mx-auto max-w-3xl px-6">
            <div className="flex gap-1 overflow-x-auto pb-px scrollbar-none">
              {tabs.map((tab) => {
                const { label, Icon } = TAB_CONFIG[tab];
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-semibold border-b-2 transition-all duration-[--duration-fast] ${
                      isActive
                        ? 'border-[--rb-brand] text-[--rb-brand]'
                        : 'border-transparent text-[--rb-text-muted] hover:text-[--rb-text-secondary] hover:border-[--rb-border-strong]'
                    }`}
                  >
                    <Icon className="size-3.5" strokeWidth={1.5} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-3xl px-6 py-6">
        {activeTab === null && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[--rb-text-muted] text-sm">No media uploaded yet.</p>
          </div>
        )}

        {(activeTab === 'audio' || activeTab === 'debate_audio') && (() => {
          const asset = getAsset(activeTab);
          if (!asset) return null;
          return (
            <div className="rb-card p-6 max-w-md mx-auto">
              <div className="text-center mb-2 text-sm font-semibold text-[--rb-text]">
                {TAB_CONFIG[activeTab].label}
              </div>
              <AudioPlayer src={asset.signed_url} title={asset.file_name} />
            </div>
          );
        })()}

        {activeTab === 'video' && (() => {
          const asset = getAsset('video');
          if (!asset) return null;
          return (
            <div className="rb-card overflow-hidden">
              <video
                src={asset.signed_url}
                controls
                className="w-full aspect-video bg-black"
                aria-label="Career overview video"
              />
            </div>
          );
        })()}

        {(activeTab === 'deck' || activeTab === 'resume') && (() => {
          const asset = getAsset(activeTab);
          if (!asset) return null;
          return (
            <div className="rb-card overflow-hidden">
              <iframe
                src={asset.signed_url}
                title={asset.file_name}
                className="w-full"
                style={{ height: '70vh' }}
              />
            </div>
          );
        })()}

        {activeTab === 'infographic' && (() => {
          const asset = getAsset('infographic');
          if (!asset) return null;
          return (
            <div className="rb-card p-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.signed_url}
                alt="Career infographic"
                className="max-w-full max-h-[70vh] object-contain rounded-[--radius-lg]"
              />
            </div>
          );
        })()}

        {activeTab === 'chat' && (
          <div className="rb-card p-8 text-center">
            <MessageCircle className="size-10 mx-auto text-[--rb-brand] mb-3" strokeWidth={1.5} />
            <h3 className="text-base font-semibold text-[--rb-text] mb-1">AI Chat coming soon</h3>
            <p className="text-sm text-[--rb-text-muted]">
              Ask this candidate&apos;s career AI any question about their background, experience, and goals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
