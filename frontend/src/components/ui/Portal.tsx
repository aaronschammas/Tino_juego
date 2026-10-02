'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

let activePortalsCount = 0;

export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    activePortalsCount++;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      setMounted(false);
      activePortalsCount--;
      if (activePortalsCount <= 0) {
        activePortalsCount = 0;
        document.body.style.overflow = '';
      }
    };
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
