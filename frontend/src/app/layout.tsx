import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { TimerProvider } from '@/context/TimerContext';

export const metadata: Metadata = {
  title: {
    default: 'Tino | Operacion, tiempo y proyectos en un solo lugar',
    template: '%s | Tino',
  },
  description:
    'Tino unifica proyectos, tareas, tiempo y visibilidad operativa para equipos que necesitan ejecutar con claridad.',
  icons: {
    icon: '/logo-tino.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tino',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#1e3a5f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className="antialiased">
        <AuthProvider>
          <TimerProvider>{children}</TimerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
