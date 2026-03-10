"use client";

import Image from "next/image";

import { ScrollReveal } from "./scroll-reveal";

const FEATURE_POSTERS = [
  {
    id: "trusted",
    title: "Trusted",
    description:
      "Delegate critical tasks to agentic workflows with repeatable outcomes and clear review guardrails.",
    imageSrc: "/images/landing/crewai-trusted.jpg",
    imageAlt:
      "Trusted poster showing an agent workflow timeline with task start, LLM call, tool call, completion, and guardrail highlights.",
    highlights: ["Workflow tracing", "Agent training", "Task guardrails"],
  },
  {
    id: "scalable",
    title: "Scalable",
    description:
      "Roll out agent operations across teams with centralized configuration, access control, and infrastructure primitives.",
    imageSrc: "/images/landing/crewai-scalable.jpg",
    imageAlt:
      "Scalable poster showing workflow growth across departments with centralized agent controls.",
    highlights: [
      "LLM and tool configuration",
      "Role-based access control",
      "Serverless containers",
    ],
  },
];

export default function FeatureCards() {
  return (
    <section
      id="features"
      className="landing-deferred-section relative scroll-mt-24 overflow-hidden bg-black px-4 py-20 sm:px-6 lg:scroll-mt-28 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.03] to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1280px] fhd:max-w-[1440px] qhd:max-w-[1600px] uhd:max-w-[1760px]">
        <ScrollReveal className="mb-12 text-center">
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(26px, 3.5vw, 52px)" }}
          >
            One platform for every operational surface
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-[13px] leading-relaxed text-white/55 sm:text-sm md:max-w-3xl fhd:text-base">
            Operational trust and team-scale rollout for organizations running
            OpenClaw boards, agents, and gateways from one control plane.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-7 qhd:gap-8">
          {FEATURE_POSTERS.map((feature, index) => (
            <ScrollReveal key={feature.id} delay={index * 0.1}>
              <article className="group mx-auto h-full w-full max-w-[620px] overflow-hidden rounded-[24px] border border-white/12 bg-[#12110e] shadow-[0_16px_45px_rgba(0,0,0,0.4)] transition-colors duration-300 hover:border-white/20 fhd:max-w-[680px] qhd:max-w-[740px] uhd:max-w-[820px]">
                <div className="relative h-[280px] overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(123,227,255,0.35),transparent_46%),radial-gradient(circle_at_82%_85%,rgba(170,125,255,0.33),transparent_45%),linear-gradient(155deg,#0a1222_4%,#13203a_46%,#2a1742_100%)] sm:h-[320px] lg:h-[380px] fhd:h-[440px] qhd:h-[500px] uhd:h-[560px]">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.08),rgba(6,10,18,0.35))]" />
                  <div className="absolute inset-0">
                    <Image
                      src={feature.imageSrc}
                      alt={feature.imageAlt}
                      fill
                      sizes="(min-width: 3840px) 860px, (min-width: 2560px) 780px, (min-width: 1920px) 720px, (min-width: 1024px) calc((100vw - 8rem) / 2), 100vw"
                      quality={96}
                      className="object-contain object-center drop-shadow-[0_16px_36px_rgba(0,0,0,0.35)] transition-transform duration-500 scale-[1.04] group-hover:scale-[1.06] lg:scale-[1.05] lg:group-hover:scale-[1.07] qhd:scale-[1.05] qhd:group-hover:scale-[1.08]"
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 p-5 md:p-6 fhd:p-7">
                  <h3 className="text-lg font-semibold text-white md:text-xl fhd:text-2xl">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/65 sm:text-sm fhd:text-base">
                    {feature.description}
                  </p>

                  <ul className="mt-4 flex flex-wrap gap-2">
                    {feature.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/80 md:text-sm fhd:px-3.5 fhd:py-2"
                      >
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
