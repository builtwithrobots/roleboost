'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface Props {
  src: string;
  title?: string;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, title }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  }, [isPlaying]);

  const skip = useCallback((secs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + secs));
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = progressRef.current;
    const audio = audioRef.current;
    if (!el || !audio || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  }, [duration]);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-5 py-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <div className="text-center text-sm font-medium text-[--rb-text-secondary]">{title}</div>
      )}

      {/* Time + progress */}
      <div className="flex flex-col gap-2">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="relative h-1.5 rounded-full bg-[--rb-bg-surface-raised] cursor-pointer group"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[--rb-brand] transition-all duration-[50ms]"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-[--rb-brand] shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between text-xs font-data text-[--rb-text-muted]">
          <span>{formatTime(currentTime)}</span>
          <span>{isLoading ? '—:——' : formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5">
        <button
          onClick={() => skip(-10)}
          className="flex flex-col items-center gap-0.5 text-[--rb-text-muted] hover:text-[--rb-text] transition-colors"
          aria-label="Back 10 seconds"
        >
          <SkipBack className="size-5" strokeWidth={1.5} />
          <span className="text-[10px] font-data">10</span>
        </button>

        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="flex size-14 items-center justify-center rounded-full bg-[--rb-brand] text-white shadow-[0_4px_16px_rgb(79_70_229_/_0.35)] hover:bg-[--rb-brand-hover] hover:shadow-[0_6px_20px_rgb(79_70_229_/_0.45)] active:scale-95 transition-all duration-[--duration-fast] disabled:opacity-50"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="size-6" fill="white" />
          ) : (
            <Play className="size-6 translate-x-0.5" fill="white" />
          )}
        </button>

        <button
          onClick={() => skip(10)}
          className="flex flex-col items-center gap-0.5 text-[--rb-text-muted] hover:text-[--rb-text] transition-colors"
          aria-label="Forward 10 seconds"
        >
          <SkipForward className="size-5" strokeWidth={1.5} />
          <span className="text-[10px] font-data">10</span>
        </button>
      </div>
    </div>
  );
}
