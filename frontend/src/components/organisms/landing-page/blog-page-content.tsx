import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cloud, Code2, ShieldCheck } from "lucide-react";

import { ScrollReveal } from "@/components/organisms/landing-page/scroll-reveal";

import {
  BLOG_CATEGORIES,
  BLOG_PRODUCT_CARDS,
  type BlogCategorySlug,
  type BlogPost,
} from "./blog-page-content-data";

const ICONS = {
  cloud: Cloud,
  factory: ShieldCheck,
  oss: Code2,
} as const;

type BlogPageContentProps = {
  selectedCategory: BlogCategorySlug;
  filteredPosts: BlogPost[];
};

export default function BlogPageContent({
  selectedCategory,
  filteredPosts,
}: BlogPageContentProps) {
  return (
    <main id="blog-content" className="bg-black pb-20 pt-28 sm:pt-32">
      <section className="px-[5%]">
        <ScrollReveal>
          <div className="mx-auto max-w-5xl rounded-3xl border border-white/15 bg-[radial-gradient(circle_at_top_left,rgba(255,91,53,0.18),rgba(255,91,53,0.02)_32%,transparent_58%)] p-8 sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Insights
            </p>
            <h1 className="mt-4 max-w-4xl text-balance font-[var(--font-display)] text-4xl leading-tight text-white sm:text-5xl">
              Practical Stories, Ideas, and Patterns for Multi-Agent Operations.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/70">
              From open-source experiments to enterprise deployments, VisgniteAI
              insights help teams design resilient AI workflows that scale from
              first prototype to production governance.
            </p>
            <nav
              className="mt-8 flex flex-wrap gap-3"
              aria-label="Blog Categories"
            >
              {BLOG_CATEGORIES.map((categoryItem) => {
                const href =
                  categoryItem.slug === "all"
                    ? "/blog"
                    : `/blog?category=${categoryItem.slug}`;
                const isSelected = selectedCategory === categoryItem.slug;
                return (
                  <Link
                    key={categoryItem.slug}
                    href={href}
                    className={`inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      isSelected
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
                    }`}
                    aria-current={isSelected ? "page" : undefined}
                  >
                    {categoryItem.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </ScrollReveal>
      </section>

      <section className="px-[5%] pt-10 sm:pt-14">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <ScrollReveal key={post.title} delay={index * 0.04}>
              <article className="group h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                {post.heroImage && (
                  <Link href={post.href} prefetch={false} className="block">
                    <div className="relative aspect-[16/9] overflow-hidden bg-[#0a1222]">
                      <Image
                        src={post.heroImage.src}
                        alt={post.heroImage.alt}
                        fill
                        sizes="(min-width: 1280px) 384px, (min-width: 768px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                )}
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    {post.category}
                  </p>
                  <h2 className="mt-4 text-2xl font-semibold leading-tight text-white">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/65">
                    {post.excerpt}
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-3 text-xs text-white/50">
                    <time dateTime={post.publishDateISO}>
                      {post.publishDateLabel}
                    </time>
                    <span>{post.readTime}</span>
                  </div>
                  <Link
                    href={post.href}
                    prefetch={false}
                    className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Read Story
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="px-[5%] pt-16 sm:pt-20">
        <ScrollReveal>
          <div className="mx-auto max-w-6xl rounded-3xl border border-white/15 bg-white/[0.04] p-8 sm:p-10">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Get Started?
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65 sm:text-base">
              Pick the deployment path that matches your team, from managed
              cloud operations to private infrastructure and open-source
              extension.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {BLOG_PRODUCT_CARDS.map((card) => {
                const Icon = ICONS[card.iconKey];
                return (
                  <article
                    key={card.title}
                    className="rounded-2xl border border-white/10 bg-black/40 p-5"
                  >
                    <div className="inline-flex rounded-xl border border-white/20 bg-white/[0.06] p-2.5">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">
                      {card.title}
                    </h3>
                    <p className="mt-3 min-h-[88px] text-sm leading-relaxed text-white/65">
                      {card.description}
                    </p>
                    <Link
                      href={card.href}
                      prefetch={false}
                      className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      target={
                        card.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        card.href.startsWith("http") ? "noreferrer" : undefined
                      }
                    >
                      {card.cta}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}
