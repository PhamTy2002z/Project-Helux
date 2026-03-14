import {
  BLOG_ARTICLES,
  BLOG_CATEGORIES,
  BLOG_PAGE_DESCRIPTION,
  BLOG_PAGE_TITLE,
  filterBlogArticles,
  getBlogPostUrl,
  type BlogArticle,
  type BlogCategorySlug,
} from "@/lib/blog-articles";

export { BLOG_CATEGORIES, BLOG_PAGE_DESCRIPTION, BLOG_PAGE_TITLE };
export type { BlogCategorySlug };

export type BlogPost = Omit<BlogArticle, "keywords" | "sections" | "slug"> & {
  href: string;
  heroImage?: { src: string; alt: string };
};

export type BlogProductCard = {
  title: string;
  description: string;
  cta: string;
  href: string;
  iconKey: "cloud" | "factory" | "oss";
};

export const BLOG_PRODUCT_CARDS: BlogProductCard[] = [
  {
    title: "FlowGrid Cloud",
    description:
      "Manage the full AI agent lifecycle with visual controls, policy guardrails, and real-time telemetry.",
    cta: "Start Building Free",
    href: "/onboarding",
    iconKey: "cloud",
  },
  {
    title: "FlowGrid Factory",
    description:
      "Deploy mission-critical workflows into private VPCs or on-prem clusters with governance controls built in.",
    cta: "Talk to Sales",
    href: "/pricing",
    iconKey: "factory",
  },
  {
    title: "FlowGrid OSS",
    description:
      "Use open APIs and modular components to build custom orchestration layers around your own systems.",
    cta: "Read Docs",
    href: "https://github.com/PhamTy2002z/FlowGrid/tree/master/docs",
    iconKey: "oss",
  },
];

function toBlogPost(article: BlogArticle): BlogPost {
  return {
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    publishDateISO: article.publishDateISO,
    publishDateLabel: article.publishDateLabel,
    readTime: article.readTime,
    heroImage: article.heroImage,
    href: getBlogPostUrl(article.slug),
  };
}

export const BLOG_POSTS: BlogPost[] = BLOG_ARTICLES.map(toBlogPost);

export function resolveBlogCategory(rawCategory: string | string[] | undefined): BlogCategorySlug {
  const selected = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  const category = (selected ?? "all").trim().toLowerCase();
  return BLOG_CATEGORIES.some((entry) => entry.slug === category)
    ? (category as BlogCategorySlug)
    : "all";
}

export function filterBlogPosts(category: BlogCategorySlug): BlogPost[] {
  return filterBlogArticles(category).map(toBlogPost);
}
