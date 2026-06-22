'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cardStagger, cardEnter } from '@/lib/motion-dashboard';
import AssetUploadCard from '@/components/candidate/AssetUploadCard';

const ASSET_TYPES = ['audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume'] as const;
type AssetType = typeof ASSET_TYPES[number];

interface ExistingAsset {
  id: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
  signed_url?: string;
}

interface Props {
  candidateProfileId: string;
  assetByType: Record<AssetType, ExistingAsset | null>;
  uploadedCount: number;
}

export default function AssetsGrid({ candidateProfileId, assetByType, uploadedCount }: Props) {
  const prefersReduced = useReducedMotion();

  return (
    <>
      {/* Progress bar */}
      <div className="bg-[var(--rb-bg-surface)] border-b border-[var(--rb-border)] px-6 pb-4">
        <div className="mx-auto max-w-5xl">
          <div className="h-1.5 rounded-full bg-[var(--rb-bg-surface-raised)] overflow-hidden">
            <motion.div
              className="h-full bg-[var(--rb-brand)] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(uploadedCount / ASSET_TYPES.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <motion.div
        className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        variants={cardStagger}
        initial={prefersReduced ? false : 'hidden'}
        animate="visible"
      >
        {ASSET_TYPES.map((type) => (
          <motion.div key={type} variants={cardEnter}>
            <AssetUploadCard
              assetType={type}
              candidateProfileId={candidateProfileId}
              existingAsset={assetByType[type] ?? undefined}
            />
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}
