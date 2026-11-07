import { useEffect } from 'react';

export default function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;

    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-h', `${h}px`);
    };

    const onViewportScroll = () => {
      update();
      window.scrollTo(0, 0); 
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', onViewportScroll);
    window.addEventListener('resize', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', onViewportScroll);
      window.removeEventListener('resize', update);
    };
  }, []);
}