import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
  },
};

// withBotId adds the proxy rewrites the BotID client challenge needs so it isn't
// blocked by ad-blockers. The public chat surface is the protected route (see
// instrumentation-client.ts).
export default withBotId(nextConfig);
