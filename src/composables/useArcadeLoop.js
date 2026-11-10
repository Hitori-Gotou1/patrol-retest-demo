import {onBeforeUnmount} from 'vue';
import {onBeforeRouteLeave} from 'vue-router';
// Fixed simulation steps keep play consistent on 30/60/120 Hz displays.
export function useArcadeLoop(step,pause,keyHandler){
  let frame=0,last=0,accumulator=0;
  function tick(now){if(last){accumulator+=Math.min(.1,(now-last)/1000);while(frame&&accumulator>=1/120){step(1/120);accumulator-=1/120;}}if(frame){last=now;frame=requestAnimationFrame(tick);}}
  function start(){if(!frame){last=0;accumulator=0;frame=requestAnimationFrame(tick);}}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;accumulator=0;pause();}
  function hidden(){if(document.hidden)stop();}
  function key(e){if(e.type==='keydown'&&e.target instanceof Element&&e.target.closest('input,textarea,select,button,[contenteditable=true]'))return;keyHandler?.(e);}
  document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',stop);window.addEventListener('pagehide',stop);window.addEventListener('keydown',key);window.addEventListener('keyup',key);
  onBeforeRouteLeave(stop);onBeforeUnmount(()=>{stop();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',stop);window.removeEventListener('pagehide',stop);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);});
  return {start,stop};
}
