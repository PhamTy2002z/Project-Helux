import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import { ScrollProvider } from "@/components/providers/scroll-provider";
import {
  BLOG_ARTICLES,
  getBlogArticleBySlug,
  getBlogPostUrl,
} from "@/lib/blog-articles";
import {
  DEFAULT_SEO_IMAGE,
  DEFAULT_SEO_IMAGE_ALT,
  PRODUCT_NAME,
} from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return BLOG_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticleBySlug(slug);
  if (!article) {
    return {
      title: "Article Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = getBlogPostUrl(article.slug);

  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: canonicalPath,
    },
    keywords: article.keywords,
    openGraph: {
      type: "article",
      url: canonicalPath,
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishDateISO,
      images: [{ url: DEFAULT_SEO_IMAGE, alt: DEFAULT_SEO_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [DEFAULT_SEO_IMAGE],
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = getBlogArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const articleUrl = `${siteUrl}${getBlogPostUrl(article.slug)}`;
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishDateISO,
    author: {
      "@type": "Organization",
      name: PRODUCT_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: PRODUCT_NAME,
    },
    mainEntityOfPage: articleUrl,
    image: [`${siteUrl}${DEFAULT_SEO_IMAGE}`],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData),
        }}
      />
      <ScrollProvider>
        <div className="landing-page min-h-screen overflow-x-hidden bg-black text-white">
          <LandingNavbar />
          <main className="bg-black pb-20 pt-28 sm:pt-32">
            <article className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                {article.category}
              </p>
              <h1 className="mt-4 text-balance font-[var(--font-display)] text-4xl leading-tight sm:text-5xl">
                {article.title}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
                {article.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/50">
                <time dateTime={article.publishDateISO}>{article.publishDateLabel}</time>
                <span>{article.readTime}</span>
              </div>

              <div className="mt-10 space-y-10">
                {article.sections.map((section) => (
                  <section key={section.heading}>
                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">{section.heading}</h2>
                    <div className="mt-4 space-y-4">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-base leading-relaxed text-white/75">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section className="mt-12 rounded-2xl border border-white/15 bg-white/[0.04] p-6">
                <h2 className="text-xl font-semibold text-white">Next Step for Your Team</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                  Move from article insights to execution by launching your first board and routing
                  approvals with policy controls in FlowGrid.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/onboarding" className="hero-btn-primary inline-flex items-center">
                    Start Free in 2 Minutes
                  </Link>
                  <Link href="/pricing" className="hero-btn-secondary inline-flex items-center">
                    View Pricing
                  </Link>
                  <Link href="/blog" className="inline-flex items-center text-sm font-semibold text-white/80">
                    Back to Blog
                  </Link>
                </div>
              </section>
            </article>
          </main>
          <LandingFooter />
        </div>
      </ScrollProvider>
    </>
  );
}
