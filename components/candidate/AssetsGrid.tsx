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
}

export default function AssetsGrid({ candidateProfileId, assetByType }: Props) {
  const prefersReduced = useReducedMotion();

  return (
    <>
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
