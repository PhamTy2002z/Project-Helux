"use client";

import type { ComponentType, SVGProps } from "react";

/* Minimal SVG mark icons for each brand — displayed before brand name */
function IbmMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M0 5h8v2H0zm10 0h4v2h-4zm6 0h8v2h-8zM0 9h4v2H4v2h4v2H0zm6-0h2v6H6zm4 0h4v2h-2v2h2v2h-4zm6 0h2v2h2v2h-2v2h-2zm4 0h4v6h-4v-2h2v-2h-2z" />
    </svg>
  );
}

function PwcMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2 6h4l2 6 2-6h4l-4 12H6zm12 0h4c3 0 5 2 5 4s-2 4-5 4h-1v4h-3z" />
    </svg>
  );
}

function DocuSignMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 2h10l6 6v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm6 10l-3 3 1.5 1.5L12 13l3.5 3.5L17 15l-3-3 3-3-1.5-1.5L12 11 8.5 7.5 7 9z" />
    </svg>
  );
}

function PepsiCoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 12c0-1 8-6 16-2M4 14c4-4 12-2 16 0" />
    </svg>
  );
}

function NttDataMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2 6h3v12H2zm5 0h3l4 8V6h3v12h-3l-4-8v8H7zm14 0h-6v3h1.5v9H18V9h1.5V6z" />
    </svg>
  );
}

function GloboMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function HavasMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2 6h3v4h4V6h3v12H9v-5H5v5H2zm12 0h3v9h4V6h3v12h-10z" />
    </svg>
  );
}

function RbcMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 4h8c2 0 4 1.5 4 3.5S14 11 12 11l4 5h-3.5L9 11V16H6V7h6c1 0 2-.5 2-1.5S13 4 12 4H4zm14 0h4c2 0 3 1 3 2.5S21 9 20 9c1 0 2 1 2 2.5S21 14 19 14h-5z" />
    </svg>
  );
}

function GenpactMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10V12h5.5c.28 0 .5-.22.5-.5v-3c0-.28-.22-.5-.5-.5H12V2z" />
    </svg>
  );
}

function BdoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2 4h5c2.5 0 4 1.5 4 4s-1.5 4-4 4H5v6H2zm3 6h2c1 0 1.5-.5 1.5-2S8 6 7 6H5zm8-6h5c3 0 5 3 5 7s-2 7-5 7h-5zm3 12h2c1.5 0 2.5-2 2.5-5s-1-5-2.5-5h-2z" />
    </svg>
  );
}

/* Brand data: SVG component icon OR image URL */
type Brand =
  | { name: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; imgSrc?: never }
  | { name: string; imgSrc: string; Icon?: never };

const BRANDS: Brand[] = [
  { name: "IBM", Icon: IbmMark },
  { name: "PwC", Icon: PwcMark },
  { name: "DocuSign", Icon: DocuSignMark },
  { name: "PepsiCo", Icon: PepsiCoMark },
  { name: "NTT Data", Icon: NttDataMark },
  { name: "Globo", Icon: GloboMark },
  { name: "Havas", Icon: HavasMark },
  { name: "RBC", Icon: RbcMark },
  { name: "Genpact", Icon: GenpactMark },
  { name: "BDO", Icon: BdoMark },
  /* Tech integrations */
  { name: "OpenAI", imgSrc: "/icons/brands/openai.svg" },
  { name: "Anthropic", imgSrc: "https://cdn.simpleicons.org/anthropic/white" },
  { name: "Google Cloud", imgSrc: "https://cdn.simpleicons.org/googlecloud/white" },
  { name: "GitHub", imgSrc: "https://cdn.simpleicons.org/github/white" },
  { name: "Vercel", imgSrc: "https://cdn.simpleicons.org/vercel/white" },
  { name: "Docker", imgSrc: "https://cdn.simpleicons.org/docker/white" },
  { name: "Kubernetes", imgSrc: "https://cdn.simpleicons.org/kubernetes/white" },
  { name: "PostgreSQL", imgSrc: "https://cdn.simpleicons.org/postgresql/white" },
  { name: "Redis", imgSrc: "https://cdn.simpleicons.org/redis/white" },
  { name: "Next.js", imgSrc: "https://cdn.simpleicons.org/nextdotjs/white" },
];

function BrandItem({ brand }: { brand: Brand }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      {brand.Icon ? (
        <brand.Icon className="h-5 w-5 text-white/85 sm:h-6 sm:w-6" aria-hidden="true" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={brand.imgSrc}
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
          className="h-5 w-5 opacity-80 sm:h-6 sm:w-6"
          loading="lazy"
        />
      )}
      <span className="text-xs font-semibold text-white/90 sm:text-sm fhd:text-base">
        {brand.name}
      </span>
    </span>
  );
}

/**
 * Single-row trust marquee for the hero section bottom.
 * Logos scroll left continuously with CSS animation.
 * Matches CrewAI style: logo icon before brand name, 72px gap.
 */
export default function TrustMarquee() {
  return (
    <div className="relative z-10 border-t border-white/10 px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20">
      <p className="mb-6 text-center text-lg font-medium tracking-tight text-white/80 sm:mb-8 sm:text-xl md:text-2xl">
        Loved by AI builders. Trusted by AI leaders.
      </p>
      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-black to-transparent sm:w-16" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-black to-transparent sm:w-16" />

        {/* Four identical strips keep the viewport continuously filled, so the loop resets without a dead gap. */}
        <div className="animate-marquee-loop flex w-max items-center [--marquee-end:-25%] [animation-duration:32s] fhd:[animation-duration:28s]">
          {Array.from({ length: 4 }).map((_, stripIndex) => (
            <div
              key={stripIndex}
              aria-hidden={stripIndex > 0}
              className="flex shrink-0 items-center gap-6 pr-6 sm:gap-8 sm:pr-8 fhd:gap-10 fhd:pr-10"
            >
              {BRANDS.map((brand) => (
                <span key={`${stripIndex}-${brand.name}`} className="inline-flex shrink-0">
                  <BrandItem brand={brand} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
