import type { PlayerSource } from './usePurePlayer';

export function parseVideoUrl(input: string): Omit<PlayerSource, 'id'> {
  const uri = input.trim().replace(/^https?(?=:\/\/)/i, (scheme) => scheme.toLowerCase());
  const authority = /^https?:\/\/([^/?#\\\s]+)/.exec(uri)?.[1];
  if (!authority || /[\s\\]/.test(uri)) {
    throw new Error('Enter a valid HTTP or HTTPS video URL.');
  }
  if (authority.includes('@')) {
    throw new Error('Remove the username and password from the video URL.');
  }

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS video URL.');
  }
  if (!url.hostname) throw new Error('Enter a valid HTTP or HTTPS video URL.');

  const path = url.pathname.toLowerCase();
  const format = path.endsWith('.m3u8') ? 'hls' : path.endsWith('.mpd') ? 'dash' : 'auto';
  return { uri, format };
}
