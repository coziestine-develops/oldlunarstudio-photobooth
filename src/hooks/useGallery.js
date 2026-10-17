import { useState, useEffect, useCallback } from 'react';
import { resizeDataURL } from '../utils/canvas.js';

const KEY = 'oldluna_v3';
const MAX = 48;

function read() { try { return JSON.parse(localStorage.getItem(KEY))||[]; } catch { return []; } }
function write(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); }
  catch(e) { if(e.name==='QuotaExceededError') { try { localStorage.setItem(KEY, JSON.stringify(arr.slice(arr.length>>1))); } catch{} } }
}

export function useGallery() {
  const [photos, setPhotos] = useState(read);
  useEffect(() => { const h=()=>setPhotos(read()); window.addEventListener('storage',h); return ()=>window.removeEventListener('storage',h); }, []);

  const save = useCallback(async (dataUrl, meta={}) => {
    const thumb = await resizeDataURL(dataUrl, 320).catch(()=>dataUrl);
    const entry = { id:`ol_${Date.now()}_${Math.random().toString(36).slice(2,5)}`, dataUrl, thumb, date:new Date().toISOString(), ...meta };
    setPhotos(prev=>{ const n=[entry,...prev].slice(0,MAX); write(n); return n; });
    return entry.id;
  }, []);

  const del    = useCallback(id  => setPhotos(prev=>{const n=prev.filter(p=>p.id!==id);write(n);return n;}), []);
  const clear  = useCallback(()  => { setPhotos([]); try{localStorage.removeItem(KEY);}catch{} }, []);

  return { photos, save, del, clear, count:photos.length };
}
