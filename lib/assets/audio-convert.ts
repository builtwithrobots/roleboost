import 'server-only';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';

// On Vercel the bundled static binary is used; FFMPEG_PATH lets local dev point
// at a system ffmpeg (the sandbox cannot download the static binary). 'ffmpeg'
// is the last-resort fallback (PATH lookup).
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

/**
 * Which audio uploads need transcoding. MP3 is already progressive and plays in
 * every browser, so it passes through untouched. Everything else (NotebookLM
 * DASH m4a, wav, aac, ogg, opus, webm, ...) is normalized to MP3, which is what
 * guarantees playback across all browsers without fail.
 */
export function needsAudioConversion(fileName: string): boolean {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  return ext !== 'mp3';
}

/** Transcode any audio buffer to a progressive MP3 buffer. */
export async function convertToMp3(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'rb-audio-'));
  const inputPath = join(dir, 'input');
  const outputPath = join(dir, 'output.mp3');
  try {
    await writeFile(inputPath, input);
    await runFfmpeg([
      '-i', inputPath,
      '-vn', // drop any (cover art / video) stream; keep audio only
      '-c:a', 'libmp3lame',
      '-q:a', '2', // ~190kbps VBR, transparent for voice
      '-ar', '44100',
      '-y',
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
