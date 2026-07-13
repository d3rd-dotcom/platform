import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/home',
    name: 'Mental Wealth Academy',
    short_name: 'MWA',
    description: 'Mental Wealth Academy installed on your home screen for faster access.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      {
        src: '/icons/icon-192.png?v=4',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png?v=4',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png?v=4',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
