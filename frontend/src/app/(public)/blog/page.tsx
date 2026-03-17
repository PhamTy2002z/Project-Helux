import type { Metadata } from "next";

import LandingFooter from "@/components/organisms/landing-page/landing-footer";
import LandingNavbar from "@/components/organisms/landing-page/landing-navbar";
import BlogPageContent from "@/components/organisms/landing-page/blog-page-content";
import {
  BLOG_PAGE_DESCRIPTION,
  BLOG_PAGE_TITLE,
  filterBlogPosts,
  resolveBlogCategory,
} from "@/components/organisms/landing-page/blog-page-content-data";
import { ScrollProvider } from "@/components/providers/scroll-provider";
import { DEFAULT_SEO_IMAGE, DEFAULT_SEO_IMAGE_ALT } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: BLOG_PAGE_TITLE,
  description: BLOG_PAGE_DESCRIPTION,
  alternates: {
    canonical: "/blog",
  },
  keywords: [
    "flowgrid blog",
    "ai agent tutorials",
    "enterprise ai operations",
    "agent factory deployment",
  ],
  openGraph: {
    title: BLOG_PAGE_TITLE,
    description: BLOG_PAGE_DESCRIPTION,
    url: "/blog",
    type: "website",
    images: [{ url: DEFAULT_SEO_IMAGE, alt: DEFAULT_SEO_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: BLOG_PAGE_TITLE,
    description: BLOG_PAGE_DESCRIPTION,
    images: [DEFAULT_SEO_IMAGE],
  },
};

type BlogPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category } = await searchParams;
  const selectedCategory = resolveBlogCategory(category);
  const filteredPosts = filterBlogPosts(selectedCategory);

  const blogStructuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: BLOG_PAGE_TITLE,
    description: BLOG_PAGE_DESCRIPTION,
    url: `${siteUrl}/blog`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: filteredPosts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publishDateISO,
          url: post.href.startsWith("http")
            ? post.href
            : `${siteUrl}${post.href}`,
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogStructuredData) }}
      />
      <ScrollProvider>
        <div className="landing-page min-h-screen overflow-x-hidden bg-black text-white">
          <a
            href="#blog-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
          >
            Skip to Main Content
          </a>
          <LandingNavbar />
          <BlogPageContent
            selectedCategory={selectedCategory}
            filteredPosts={filteredPosts}
          />
          <LandingFooter />
        </div>
      </ScrollProvider>
    </>
  );
}
