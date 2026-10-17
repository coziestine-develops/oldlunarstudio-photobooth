export default function CaptureFlash({ active }) {
  return (
    <>
      <div className="cf" data-active={active} aria-hidden="true" />
      <style>{`
        .cf { position:fixed;inset:0;z-index:9999;background:#fff;opacity:0;pointer-events:none; }
        .cf[data-active="true"] { animation:flashAnim 0.28s var(--ease) forwards; }
      `}</style>
    </>
  );
}
