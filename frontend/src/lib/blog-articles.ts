export const BLOG_PAGE_TITLE = "Insights & Product Guides — FlowGrid";
export const BLOG_PAGE_DESCRIPTION =
  "Explore FlowGrid tutorials, enterprise operations playbooks, and factory deployment insights for AI agent workflows.";
export const BLOG_CATEGORIES = [
  { label: "All", slug: "all" },
  { label: "Tutorials", slug: "tutorials" },
  { label: "Enterprise", slug: "enterprise" },
  { label: "Factory", slug: "factory" },
] as const;
export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];
export type BlogPostCategory = Exclude<BlogCategorySlug, "all">;
export type BlogArticleSection = {
  heading: string;
  paragraphs: string[];
};
export type BlogArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogPostCategory;
  publishDateISO: string;
  publishDateLabel: string;
  readTime: string;
  keywords: string[];
  sections: BlogArticleSection[];
};
export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "launch-multi-agent-workflow-in-20-minutes",
    title: "Launch Your First Multi-Agent Workflow in 20 Minutes",
    excerpt:
      "Set up a board, route approvals, and enable gateway-aware execution in one guided sequence.",
    category: "tutorials",
    publishDateISO: "2026-02-28",
    publishDateLabel: "February 28, 2026",
    readTime: "8 min read",
    keywords: ["multi-agent workflow", "board orchestration", "agent approvals"],
    sections: [
      {
        heading: "Start with one board, one policy, one owner",
        paragraphs: [
          "Create a single board that represents a real workflow. Define ownership before adding automation so escalation paths stay clear.",
          "FlowGrid teams ship faster when they enforce one approval policy first, then widen access after baseline metrics are stable.",
        ],
      },
      {
        heading: "Add gateway-aware execution and rollout checks",
        paragraphs: [
          "Attach agents to a gateway profile and track task events end to end. Keep the first deployment narrow and observable.",
          "Once throughput and failure rates are predictable, clone the blueprint to additional boards instead of rebuilding each flow manually.",
        ],
      },
    ],
  },
  {
    slug: "approval-policies-for-regulated-teams",
    title: "Designing Approval Policies for Regulated Teams",
    excerpt:
      "Build human-in-the-loop controls for sensitive actions while keeping delivery speed high.",
    category: "enterprise",
    publishDateISO: "2026-02-14",
    publishDateLabel: "February 14, 2026",
    readTime: "6 min read",
    keywords: ["approval workflow", "regulated operations", "human in the loop"],
    sections: [
      {
        heading: "Classify actions by operational risk",
        paragraphs: [
          "Separate low-risk automation from privileged actions such as model changes, secret access, or external side effects.",
          "This keeps everyday work fast while forcing explicit review only where legal, security, or financial risk exists.",
        ],
      },
      {
        heading: "Use policy defaults and exception paths",
        paragraphs: [
          "Set policy defaults at the board-group level so every new board inherits the same governance baseline.",
          "Keep exception flows narrow and auditable: who approved, why it was approved, and what changed after execution.",
        ],
      },
    ],
  },
  {
    slug: "factory-pattern-for-private-gateway-operations",
    title: "Factory Pattern for Private Gateway Operations",
    excerpt:
      "Run repeatable board deployment blueprints across private infrastructure and connected runtimes.",
    category: "factory",
    publishDateISO: "2026-01-29",
    publishDateLabel: "January 29, 2026",
    readTime: "7 min read",
    keywords: ["private gateway", "factory pattern", "deployment blueprint"],
    sections: [
      {
        heading: "Package your operating model as a blueprint",
        paragraphs: [
          "Blueprints should include board templates, role mappings, token limits, and required integrations.",
          "Treat blueprint versions as release artifacts so teams can roll forward safely and compare behavior over time.",
        ],
      },
      {
        heading: "Promote by environment, not by copy-paste",
        paragraphs: [
          "Promote from staging to production using the same blueprint and environment-specific secrets.",
          "This removes drift, improves rollback speed, and keeps compliance evidence consistent across regions.",
        ],
      },
    ],
  },
  {
    slug: "from-prompting-to-production-governance",
    title: "From Prompting to Production Governance",
    excerpt:
      "A practical progression from ad-hoc experiments to auditable, API-backed operating systems.",
    category: "enterprise",
    publishDateISO: "2026-01-08",
    publishDateLabel: "January 8, 2026",
    readTime: "5 min read",
    keywords: ["ai governance", "production operations", "audit trail"],
    sections: [
      {
        heading: "Move from isolated prompts to managed tasks",
        paragraphs: [
          "Prompt experiments are useful for discovery, but production teams need deterministic task models and ownership boundaries.",
          "Wrap every critical prompt in a task contract: expected input, expected output, and clear failure behavior.",
        ],
      },
      {
        heading: "Instrument first, optimize second",
        paragraphs: [
          "Capture event timelines, approvals, and gateway health before trying to optimize cost or latency.",
          "Without telemetry, optimization hides risk. With telemetry, optimization becomes an informed decision.",
        ],
      },
    ],
  },
  {
    slug: "measure-agent-reliability-with-event-timelines",
    title: "Measuring Agent Reliability with Event Timelines",
    excerpt:
      "Use unified activity streams to diagnose failures and recover task throughput faster.",
    category: "tutorials",
    publishDateISO: "2025-12-19",
    publishDateLabel: "December 19, 2025",
    readTime: "5 min read",
    keywords: ["agent reliability", "event timeline", "incident response"],
    sections: [
      {
        heading: "Track stage latency, not just success rate",
        paragraphs: [
          "A successful run can still be unhealthy if approvals or gateway hops create hidden queue time.",
          "Break each run into stages so bottlenecks become obvious and fixable.",
        ],
      },
      {
        heading: "Use incident playbooks tied to timeline patterns",
        paragraphs: [
          "Map recurring timeline signatures to clear remediation actions for operators.",
          "Teams reduce mean-time-to-recovery when responders no longer need to rediscover the same fix path.",
        ],
      },
    ],
  },
  {
    slug: "blueprint-scale-board-ops-across-teams",
    title: "Blueprint: Scale Board Ops Across Multiple Teams",
    excerpt:
      "Structure board groups, ownership rules, and task standards without sacrificing autonomy.",
    category: "factory",
    publishDateISO: "2025-12-04",
    publishDateLabel: "December 4, 2025",
    readTime: "9 min read",
    keywords: ["board groups", "operating model", "team scale"],
    sections: [
      {
        heading: "Standardize the foundation, not every decision",
        paragraphs: [
          "Standardize lifecycle states, escalation rules, and approval triggers at the platform level.",
          "Then allow teams to customize board-specific fields and playbooks for local execution context.",
        ],
      },
      {
        heading: "Measure autonomy with guardrail compliance",
        paragraphs: [
          "Healthy scale means teams move independently while staying inside common policy boundaries.",
          "Review guardrail compliance weekly and adjust templates before bad patterns spread organization-wide.",
        ],
      },
    ],
  },
];
export function getBlogPostUrl(slug: string): string {
  return `/blog/${slug}`;
}
export function getBlogArticleBySlug(slug: string): BlogArticle | null {
  return BLOG_ARTICLES.find((article) => article.slug === slug) ?? null;
}
export function filterBlogArticles(category: BlogCategorySlug): BlogArticle[] {
  if (category === "all") return BLOG_ARTICLES;
  return BLOG_ARTICLES.filter((article) => article.category === category);
}
