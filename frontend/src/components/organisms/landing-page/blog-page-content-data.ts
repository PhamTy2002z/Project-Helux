export const BLOG_PAGE_TITLE = "Insights & Product Guides — OpenClaw Mission Control";
export const BLOG_PAGE_DESCRIPTION =
  "Explore OpenClaw tutorials, enterprise operations playbooks, and factory deployment insights for AI agent workflows.";

export const BLOG_CATEGORIES = [
  { label: "All", slug: "all" },
  { label: "Tutorials", slug: "tutorials" },
  { label: "Enterprise", slug: "enterprise" },
  { label: "Factory", slug: "factory" },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];
export type BlogPostCategory = Exclude<BlogCategorySlug, "all">;

export type BlogPost = {
  title: string;
  excerpt: string;
  category: BlogPostCategory;
  href: string;
  publishDateISO: string;
  publishDateLabel: string;
  readTime: string;
};

export type BlogProductCard = {
  title: string;
  description: string;
  cta: string;
  href: string;
  iconKey: "cloud" | "factory" | "oss";
};

export const BLOG_POSTS: BlogPost[] = [
  {
    title: "Launch Your First Multi-Agent Workflow in 20 Minutes",
    excerpt: "Set up a board, route approvals, and enable gateway-aware execution in one guided sequence.",
    category: "tutorials",
    href: "/onboarding",
    publishDateISO: "2026-02-28",
    publishDateLabel: "February 28, 2026",
    readTime: "8 min read",
  },
  {
    title: "Designing Approval Policies for Regulated Teams",
    excerpt: "Build human-in-the-loop controls for sensitive actions while keeping delivery speed high.",
    category: "enterprise",
    href: "/pricing",
    publishDateISO: "2026-02-14",
    publishDateLabel: "February 14, 2026",
    readTime: "6 min read",
  },
  {
    title: "Factory Pattern for Private Gateway Operations",
    excerpt: "Run repeatable board deployment blueprints across private infrastructure and connected runtimes.",
    category: "factory",
    href: "/testimonials",
    publishDateISO: "2026-01-29",
    publishDateLabel: "January 29, 2026",
    readTime: "7 min read",
  },
  {
    title: "From Prompting to Production Governance",
    excerpt: "A practical progression from ad-hoc experiments to auditable, API-backed operating systems.",
    category: "enterprise",
    href: "/",
    publishDateISO: "2026-01-08",
    publishDateLabel: "January 8, 2026",
    readTime: "5 min read",
  },
  {
    title: "Measuring Agent Reliability with Event Timelines",
    excerpt: "Use unified activity streams to diagnose failures and recover task throughput faster.",
    category: "tutorials",
    href: "/testimonials",
    publishDateISO: "2025-12-19",
    publishDateLabel: "December 19, 2025",
    readTime: "5 min read",
  },
  {
    title: "Blueprint: Scale Board Ops Across Multiple Teams",
    excerpt: "Structure board groups, ownership rules, and task standards without sacrificing autonomy.",
    category: "factory",
    href: "/pricing",
    publishDateISO: "2025-12-04",
    publishDateLabel: "December 4, 2025",
    readTime: "9 min read",
  },
];

export const BLOG_PRODUCT_CARDS: BlogProductCard[] = [
  {
    title: "OpenClaw Cloud",
    description:
      "Manage the full AI agent lifecycle with visual controls, policy guardrails, and real-time telemetry.",
    cta: "Request a Demo",
    href: "/onboarding",
    iconKey: "cloud",
  },
  {
    title: "OpenClaw Factory",
    description:
      "Deploy mission-critical workflows into private VPCs or on-prem clusters with governance controls built in.",
    cta: "Talk to Sales",
    href: "/pricing",
    iconKey: "factory",
  },
  {
    title: "OpenClaw OSS",
    description:
      "Use open APIs and modular components to build custom orchestration layers around your own systems.",
    cta: "Read Docs",
    href: "https://github.com/abhi1693/openclaw-mission-control/tree/master/docs",
    iconKey: "oss",
  },
];

export function resolveBlogCategory(rawCategory: string | string[] | undefined): BlogCategorySlug {
  const selected = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  const category = (selected ?? "all").trim().toLowerCase();
  return BLOG_CATEGORIES.some((entry) => entry.slug === category)
    ? (category as BlogCategorySlug)
    : "all";
}

export function filterBlogPosts(category: BlogCategorySlug): BlogPost[] {
  if (category === "all") return BLOG_POSTS;
  return BLOG_POSTS.filter((post) => post.category === category);
}
