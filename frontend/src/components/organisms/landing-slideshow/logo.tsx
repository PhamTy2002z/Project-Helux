export default function Logo() {
  return (
    <div className="leading-none">
      <div className="text-[18px] font-semibold tracking-[-0.02em] text-white">FlowGrid</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70">
        <span>OpenClaw</span>
        <span className="text-white/30">·</span>
        <span className="text-white/40">Agent Operations</span>
      </div>
    </div>
  );
}
