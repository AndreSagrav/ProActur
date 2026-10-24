import { useState, useEffect } from 'react';

export function useDeviceType() {
  const [device, setDevice] = useState(() => {
    if (typeof window === 'undefined') return { isMobile: false, isTablet: false, isDesktop: true, isCompact: false, isTouchDevice: false };
    const width = window.innerWidth;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    return {
      isMobile,
      isTablet,
      isDesktop: width >= 1024,
      isCompact: width < 1024,
      isTouchDevice: width < 1024 || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      setDevice({
        isMobile,
        isTablet,
        isDesktop: width >= 1024,
        isCompact: width < 1024,
        isTouchDevice: width < 1024 || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return device;
}

