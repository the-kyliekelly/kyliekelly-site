// Picks one of Kylie's cover photos (src/assets/episode-photos) for an episode, or a guest's headshot
// when one has been added (src/assets/guest-photos).
import type { ImageMetadata } from 'astro';
import { guestPhotoFor } from './guestPhotos';

const found = import.meta.glob<{ default: ImageMetadata }>('../assets/episode-photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { eager: true });
const photos = Object.entries(found)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);

export function photoFor(num: string | number, spread = 1): ImageMetadata | null {
  return guestPhotoFor(num) ?? (photos.length ? photos[(Number(num) * spread) % photos.length] : null);
}
