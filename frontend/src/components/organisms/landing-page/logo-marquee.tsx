"use client";

import { ScrollReveal } from "./scroll-reveal";

/* Tech stack / partner logos as simple text badges (SVG icons can replace later) */
const LOGOS = [
  "Next.js",
  "React",
  "Tailwind CSS",
  "Clerk",
  "Vercel",
  "PostgreSQL",
  "Redis",
  "Docker",
  "Kubernetes",
  "GitHub",
];

function LogoItem({ name }: { name: string }) {
  return (
    <span className="mx-8 inline-flex shrink-0 items-center text-base font-medium text-white/40">
      {name}
    </span>
  );
}

export default function LogoMarquee() {
  return (
    <section className="overflow-hidden bg-black py-16">
      <ScrollReveal className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/40">
          Built with trusted technologies
        </p>
      </ScrollReveal>

      {/* Row 1 — scrolls left */}
      <div className="relative flex overflow-hidden">
        <div className="animate-marquee flex shrink-0">
          {LOGOS.map((name) => (
            <LogoItem key={name} name={name} />
          ))}
        </div>
        <div className="animate-marquee flex shrink-0" aria-hidden="true">
          {LOGOS.map((name) => (
            <LogoItem key={`dup-${name}`} name={name} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right */}
      <div className="relative mt-4 flex overflow-hidden">
        <div className="animate-marquee-reverse flex shrink-0">
          {LOGOS.map((name) => (
            <LogoItem key={name} name={name} />
          ))}
        </div>
        <div
          className="animate-marquee-reverse flex shrink-0"
          aria-hidden="true"
        >
          {LOGOS.map((name) => (
            <LogoItem key={`dup-${name}`} name={name} />
          ))}
        </div>
      </div>
    </section>
  );
}
