"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ScrollReveal } from "./scroll-reveal";
import { SHOWCASE_STORIES } from "./feature-story-showcase-data";

export default function FeatureStoryShowcase() {
  return (
    <section
      id="workflow-showcase"
      className="landing-deferred-section relative overflow-hidden bg-black px-4 pb-10 pt-4 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10 lg:pb-16 fhd:px-14 qhd:px-16 uhd:px-20"
    >
      {/* Ambient glow — mirrors hero's radial glow */}
      <div className="landing-section-glow right-[5%] top-[30%] h-[25vw] max-h-[400px] w-[35vw] max-w-[500px] bg-orange-600/[0.05]" />

      <div className="mx-auto w-full max-w-[1280px] fhd:max-w-[1440px] qhd:max-w-[1600px] uhd:max-w-[1760px]">
        <div className="space-y-6">
          {SHOWCASE_STORIES.map((story, index) => (
            <ScrollReveal key={story.id} delay={index * 0.08}>
              <article className="hero-glass-card rounded-[28px] p-4 sm:p-5 lg:p-6">
                <div
                  className={`grid gap-6 rounded-[22px] bg-white/[0.03] p-3 sm:p-4 lg:items-center ${
                    index % 2 === 0
                      ? "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]"
                      : "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.85fr)]"
                  }`}
                >
                  <div
                    className={`rounded-[20px] bg-black/35 p-3 sm:p-4 ${
                      index % 2 === 0 ? "lg:order-2" : "lg:order-1"
                    }`}
                  >
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                      <div className="relative aspect-[43/24] w-full">
                        <Image
                          src={story.previewImageSrc}
                          alt={story.previewImageAlt}
                          fill
                          sizes="(min-width: 1024px) 58vw, 100vw"
                          className={`object-cover object-center ${story.previewImageClassName ?? ""}`}
                          priority={index === 0}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`px-1 sm:px-2 ${index % 2 === 0 ? "lg:order-1" : "lg:order-2"}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                      {story.kicker}
                    </p>
                    <h3 className="mt-2 text-balance text-[26px] font-medium leading-[1.2] text-white sm:text-[30px]">
                      {story.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/80 sm:text-base">
                      {story.description}
                    </p>

                    {story.beforeAfter && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-red-400/70">
                            Before
                          </p>
                          <p className="text-white/60">{story.beforeAfter.before}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-400/70">
                            After
                          </p>
                          <p className="text-white/60">{story.beforeAfter.after}</p>
                        </div>
                      </div>
                    )}

                    <ul className="mt-4 flex flex-wrap gap-2">
                      {story.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="landing-pill"
                        >
                          {highlight}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={story.ctaHref}
                      prefetch={false}
                      className="landing-cta-link mt-6"
                    >
                      {story.ctaLabel}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
