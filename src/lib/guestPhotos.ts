// Guest headshots for episode covers.
//
// Original photos go in src/assets/guest-photos, named "<episode number> - <guest name>"
// (for example "264 - Anita Mac.jpg"). Each one is cropped so the guest's face is the same size
// as in the cover photos of Kylie, and the cropped copy is saved in src/assets/guest-crops as
// "<episode number>-<guest-name>.webp". Episodes without a guest crop use Kylie's photos instead.
import type { ImageMetadata } from 'astro';

const crops = import.meta.glob<{ default: ImageMetadata }>('../assets/guest-crops/*.{webp,jpg,jpeg,png}', { eager: true });

const byEpisode = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(crops)) {
  const num = path.split('/').pop()?.match(/^(\d+)/)?.[1];
  if (num) byEpisode.set(num, mod.default);
}

export function guestPhotoFor(num: string | number): ImageMetadata | undefined {
  return byEpisode.get(String(Number(num)));
}
