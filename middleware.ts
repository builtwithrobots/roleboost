import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  // The Boosts marketing page and every persona example page (/boosts/[slug]).
  '/boosts(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/c/(.*)',
  // SEO / crawler + metadata asset routes. Their .txt/.xml/no-extension paths are
  // not covered by the matcher's static-file exclusion, so without this a
  // signed-out crawler request would be redirected to sign-in and never see them.
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/twitter-image',
  '/icons/(.*)',
  '/api/webhooks/(.*)',
  // Recruiters chat with a candidate's AI without signing in. The route reads
  // auth() itself to optionally identify a logged-in owner/employer.
  '/api/chat(.*)',
  // Transcript delivery is triggered by the chat surface on close (anonymous).
  '/api/transcripts(.*)',
  // Cron sweep (transcript safety net); self-authenticates via CRON_SECRET.
  '/api/cron/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const url = req.nextUrl;

  if (userId && (url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up'))) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files. The extension list MUST include media
    // (audio/video) as well as images/fonts/docs, otherwise Clerk runs on those
    // requests and auth-protects them: a signed-out fetch of /boosts/*.mp3 then
    // gets an HTML 404 instead of the file, and the <audio> element fails to play.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|avif|png|gif|svg|ico|ttf|woff2?|csv|docx?|xlsx?|pdf|zip|webmanifest|mp3|m4a|aac|wav|ogg|oga|opus|flac|mp4|m4v|mov|webm)).*)',
    '/(api|trpc)(.*)',
  ],
};
