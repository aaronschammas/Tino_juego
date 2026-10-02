import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tino - Operacion, tiempo y proyectos',
    short_name: 'Tino',
    description: 'Proyectos, tareas y tiempo de tu equipo en un solo lugar.',
    start_url: '/mobile',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f7f8fa',
    theme_color: '#1e3a5f',
    prefer_related_applications: false,
    icons: [
      { src: '/tino-pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/tino-pwa-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/tino-pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
