import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile devices based on screen width and user agent
 * Combines viewport width detection with user agent string analysis
 * for more reliable mobile device detection
 * 
 * @returns {boolean} true if device is mobile, false otherwise
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check screen width (mobile breakpoint at 768px)
      const mobileWidth = window.innerWidth < 768;
      
      // Check user agent for mobile devices
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      
      // Device is mobile if either condition is true
      setIsMobile(mobileWidth || mobileUA);
    };

    // Initial check
    checkMobile();
    
    // Add resize listener for responsiveness
    window.addEventListener('resize', checkMobile);
    
    // Cleanup listener on unmount
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
