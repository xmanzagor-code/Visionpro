import React, { useEffect, useRef } from 'react';
import { Language, translations } from '../translations';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  responsive?: 'true' | 'false';
  className?: string;
  type?: 'adsense' | 'hilltop';
  lang?: Language;
}

export const AdBanner: React.FC<AdBannerProps> = ({ 
  slot, 
  format = 'auto', 
  responsive = 'true',
  className = '',
  type = 'adsense',
  lang = 'tr'
}) => {
  const t = translations[lang];
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (type === 'adsense' && adRef.current) {
      const currentAdRef = adRef.current;
      const initializeAd = () => {
        try {
          // @ts-ignore
          if (typeof window === 'undefined' || !window.adsbygoogle) return;
          if (currentAdRef.getAttribute('data-adsbygoogle-status') === 'done') return;
          if (currentAdRef.offsetWidth > 0) {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } else {
            setTimeout(initializeAd, 500);
          }
        } catch (e) {
          console.error('AdSense error:', e);
        }
      };
      const timer = setTimeout(initializeAd, 200);
      return () => clearTimeout(timer);
    }
  }, [type, slot]);

  if (type === 'hilltop') {
    return (
      <div className={`ad-container hilltop-ad ${className} min-h-[100px] flex items-center justify-center bg-white/5 rounded-xl border border-white/10 overflow-hidden`}>
        <div id={`hilltop-zone-${slot}`} className="w-full h-full flex items-center justify-center text-white/20 text-xs font-mono uppercase tracking-widest">
          HilltopAds Zone {slot}
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-container adsense-ad ${className} min-h-[100px] overflow-hidden rounded-xl border border-white/10 bg-white/5`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', minWidth: '250px' }}
        data-ad-client="ca-pub-5778756614099869"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
      <div className="text-[8px] text-center text-white/20 uppercase tracking-widest py-1 border-t border-white/5">
        {t.advertisement}
      </div>
    </div>
  );
};
