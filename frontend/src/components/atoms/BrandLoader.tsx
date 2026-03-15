"use client";

/**
 * Animated logo loader — FlowGrid brand loading indicator.
 *
 * Animation sequence (2.4s loop):
 * 1. Corner nodes fade in with stagger
 * 2. Amber S-curve draws itself (stroke-dashoffset)
 * 3. Center node scales in with amber glow pulse
 * 4. Everything fades, then loops
 */
export function BrandLoader({ size = 64 }: { size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className="brand-loader"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bl-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="bl-flow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <radialGradient id="bl-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect
          x="16" y="16" width="480" height="480" rx="108"
          fill="url(#bl-bg)"
        />
        <rect
          x="16" y="16" width="480" height="480" rx="108"
          fill="none" stroke="#334155" strokeWidth="1"
        />

        {/* Corner nodes — staggered fade-in */}
        <circle className="bl-node bl-n1" cx="176" cy="176" r="28" fill="#CBD5E1" />
        <circle className="bl-node bl-n2" cx="336" cy="176" r="28" fill="#CBD5E1" />
        <circle className="bl-node bl-n3" cx="176" cy="336" r="28" fill="#CBD5E1" />
        <circle className="bl-node bl-n4" cx="336" cy="336" r="28" fill="#CBD5E1" />

        {/* Flow S-curve — draw animation */}
        <path
          className="bl-flow"
          d="M256 164 C256 200, 216 224, 212 256 C208 288, 256 310, 256 348"
          stroke="url(#bl-flow)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />

        {/* Center glow ring */}
        <circle className="bl-glow" cx="256" cy="256" r="48" fill="url(#bl-glow)" />

        {/* Center amber node */}
        <circle className="bl-center" cx="256" cy="256" r="32" fill="#FCD34D" />
        <circle className="bl-center-inner" cx="256" cy="256" r="15" fill="#78350F" />
      </svg>

      <style>{`
        /* ---- Timing ---- */
        .brand-loader {
          --dur: 2.4s;
        }

        /* ---- Corner nodes: stagger fade in/out ---- */
        .bl-node {
          opacity: 0;
          animation: blNodePulse var(--dur) ease-in-out infinite;
        }
        .bl-n1 { animation-delay: 0s; }
        .bl-n2 { animation-delay: 0.12s; }
        .bl-n3 { animation-delay: 0.24s; }
        .bl-n4 { animation-delay: 0.36s; }

        @keyframes blNodePulse {
          0%, 100% { opacity: 0.15; }
          25%, 75% { opacity: 0.8; }
        }

        /* ---- Flow curve: draw + fade ---- */
        .bl-flow {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: blFlowDraw var(--dur) ease-in-out infinite;
        }

        @keyframes blFlowDraw {
          0% { stroke-dashoffset: 220; opacity: 0; }
          15% { opacity: 1; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          80% { stroke-dashoffset: 0; opacity: 0.6; }
          100% { stroke-dashoffset: -220; opacity: 0; }
        }

        /* ---- Center glow: pulse ---- */
        .bl-glow {
          opacity: 0;
          transform-origin: 256px 256px;
          animation: blGlowPulse var(--dur) ease-in-out infinite;
        }

        @keyframes blGlowPulse {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          40% { opacity: 0.8; transform: scale(1.2); }
          70% { opacity: 0.4; transform: scale(1); }
        }

        /* ---- Center node: scale in ---- */
        .bl-center {
          opacity: 0;
          transform-origin: 256px 256px;
          animation: blCenterPop var(--dur) ease-out infinite;
        }

        @keyframes blCenterPop {
          0%, 15% { opacity: 0; transform: scale(0); }
          35% { opacity: 1; transform: scale(1.1); }
          45%, 75% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }

        /* ---- Center inner dot ---- */
        .bl-center-inner {
          opacity: 0;
          transform-origin: 256px 256px;
          animation: blCenterPop var(--dur) ease-out infinite;
          animation-delay: 0.08s;
        }

        /* ---- Reduced motion ---- */
        @media (prefers-reduced-motion: reduce) {
          .bl-node,
          .bl-flow,
          .bl-glow,
          .bl-center,
          .bl-center-inner {
            animation: none;
            opacity: 0.7;
          }
          .bl-flow {
            stroke-dasharray: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
