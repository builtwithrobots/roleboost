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
  // Audio conversion shells out to the ffmpeg-static binary. It is loaded via a
  // computed path, so file tracing does not include it automatically; force it
  // into the bundle for the routes that transcode.
  outputFileTracingIncludes: {
    '/api/assets/upload': ['./node_modules/ffmpeg-static/**'],
    '/api/assets/[id]/status': ['./node_modules/ffmpeg-static/**'],
    '/api/cron/process-audio': ['./node_modules/ffmpeg-static/**'],
  },
};

// withBotId adds the proxy rewrites the BotID client challenge needs so it isn't
// blocked by ad-blockers. The public chat surface is the protected route (see
// instrumentation-client.ts).
export default withBotId(nextConfig);
