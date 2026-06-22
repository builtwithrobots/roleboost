'use client';

import { useState, useRef, useEffect } from 'react';
import { Copy, Check, ExternalLink, Download, Eye, EyeOff, Code2 } from 'lucide-react';

interface Props {
  profileUrl: string;
  slug: string;
  fullName: string;
  headline: string;
  isPublished: boolean;
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

// QR code generator using the canvas API with a simple matrix approach
// For production you'd use a proper QR lib — this is a lightweight inline version
function QRCanvas({ url, size }: { url: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // We use an img element loading from a QR API as a fallback since
    // a proper QR encoder is ~30KB. The API approach is fine for display only.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Use a reliable QR code service
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=1&format=png`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
      // Fallback: draw a placeholder
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR code', size / 2, size / 2);
    };
  }, [url, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="block" aria-label="QR code for your profile" />;
}

function BadgeSVG({ fullName, headline }: { fullName: string; headline: string }) {
  const displayName = fullName || 'Your Name';
  const displayRole = headline
    ? headline.slice(0, 60) + (headline.length > 60 ? '…' : '')
    : 'Career Professional';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="320"
      height="80"
      viewBox="0 0 320 80"
      role="img"
      aria-label="RoleBoost profile badge"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <rect width="320" height="80" rx="12" fill="url(#bg)" />
      {/* RoleBoost wordmark */}
      <text x="16" y="22" fontFamily="system-ui, sans-serif" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.65)" letterSpacing="1">
        ROLEBOOST
      </text>
      {/* Name */}
      <text x="16" y="44" fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="700" fill="white">
        {displayName}
      </text>
      {/* Role */}
      <text x="16" y="62" fontFamily="system-ui, sans-serif" fontSize="11" fill="rgba(255,255,255,0.80)">
        {displayRole}
      </text>
      {/* Decorative dot */}
      <circle cx="304" cy="40" r="8" fill="rgba(255,255,255,0.15)" />
      <circle cx="304" cy="40" r="3" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

export default function ShareHub({ profileUrl, slug, fullName, headline, isPublished }: Props) {
  const [qrSize, setQrSize] = useState<200 | 300 | 400>(200);
  const linkCopy = useCopy(profileUrl);

  const embedCode = `<a href="${profileUrl}"><img src="https://getroleboost.com/api/badge/${slug}" alt="${fullName} on RoleBoost" width="320" height="80" /></a>`;
  const embedCopy = useCopy(embedCode);

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(profileUrl)}&margin=2&format=png`;
    link.download = `roleboost-qr-${slug}.png`;
    link.click();
  };

  return (
    <div className="min-h-full bg-[var(--rb-bg-page)]">
      {/* Header */}
      <div className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-xl font-bold text-[var(--rb-text)]">Share Hub</h1>
          <p className="mt-1 text-sm text-[var(--rb-text-muted)]">
            Share your profile link, QR code, and digital badge.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Panel 1: Profile Link */}
        <div className="rb-card p-6">
          <h2 className="text-sm font-semibold text-[var(--rb-text)] mb-1">Your Profile Link</h2>
          <p className="text-xs text-[var(--rb-text-muted)] mb-4">
            Share this link with recruiters and hiring managers.
          </p>

          {!isPublished && (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] border border-amber-200 px-3 py-2 mb-4">
              <EyeOff className="size-3.5 shrink-0 text-[var(--color-warning)]" />
              <span className="text-xs text-[var(--color-warning)] font-medium">
                Your profile is a draft. Publish it so employers can view this link.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] px-3 py-2 text-sm text-[var(--rb-text-secondary)] font-data truncate">
              getroleboost.com/c/{slug}
            </div>
            <button
              onClick={linkCopy.copy}
              className="shrink-0 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--rb-brand-hover)] transition-colors duration-[var(--duration-fast)]"
            >
              {linkCopy.copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {linkCopy.copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {isPublished && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-xs text-[var(--rb-brand)] hover:underline"
            >
              <Eye className="size-3" />
              Open your live profile
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Panel 2: QR Code */}
        <div className="rb-card p-6">
          <h2 className="text-sm font-semibold text-[var(--rb-text)] mb-1">QR Code</h2>
          <p className="text-xs text-[var(--rb-text-muted)] mb-4">
            Add to your resume or email signature. Scan to open your profile.
          </p>

          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[var(--radius-xl)] border border-[var(--rb-border)] p-3 bg-white">
              <QRCanvas url={profileUrl} size={160} />
            </div>

            {/* Size selector */}
            <div className="flex gap-2">
              {([200, 300, 400] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setQrSize(s)}
                  className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-all duration-[var(--duration-fast)] ${
                    qrSize === s
                      ? 'bg-[var(--rb-brand)] text-white'
                      : 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-secondary)] hover:bg-[var(--rb-border)]'
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>

            <button
              onClick={downloadQR}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--rb-text-secondary)] hover:border-[var(--rb-border-strong)] hover:bg-[var(--rb-bg-surface-raised)] transition-all duration-[var(--duration-fast)]"
            >
              <Download className="size-3.5" />
              Download PNG ({qrSize}×{qrSize})
            </button>
          </div>
        </div>

        {/* Panel 3: Digital Badge (full width) */}
        <div className="md:col-span-2 rb-card p-6">
          <h2 className="text-sm font-semibold text-[var(--rb-text)] mb-1">Digital Badge</h2>
          <p className="text-xs text-[var(--rb-text-muted)] mb-4">
            Add to your LinkedIn profile, email signature, or portfolio. Links directly to your RoleBoost profile.
          </p>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Badge preview */}
            <div className="shrink-0">
              <BadgeSVG fullName={fullName} headline={headline} />
            </div>

            {/* Badge actions */}
            <div className="flex-1 flex flex-col gap-4">
              {/* LinkedIn instructions */}
              <div className="rounded-[var(--radius-lg)] bg-[var(--rb-bg-surface-raised)] border border-[var(--rb-border)] p-4">
                <div className="text-xs font-semibold text-[var(--rb-text)] mb-1">Add to LinkedIn</div>
                <ol className="text-xs text-[var(--rb-text-secondary)] space-y-1 list-decimal list-inside">
                  <li>Download the badge image below</li>
                  <li>Go to LinkedIn → Me → Edit Profile</li>
                  <li>Add the image to your Featured section</li>
                  <li>Set the link to your RoleBoost profile URL</li>
                </ol>
              </div>

              {/* Embed code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[var(--rb-text-secondary)]">HTML embed code</span>
                  <button
                    onClick={embedCopy.copy}
                    className="flex items-center gap-1 text-xs text-[var(--rb-brand)] hover:underline"
                  >
                    <Code2 className="size-3" />
                    {embedCopy.copied ? 'Copied!' : 'Copy code'}
                  </button>
                </div>
                <pre className="text-xs bg-[var(--rb-bg-surface-sunken)] border border-[var(--rb-border)] rounded-[var(--radius-md)] px-3 py-2.5 text-[var(--rb-text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {embedCode}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
