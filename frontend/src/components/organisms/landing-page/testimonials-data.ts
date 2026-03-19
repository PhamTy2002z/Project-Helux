/** Centralized testimonial data shared by landing carousel and /testimonials page. */

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  company: string;
  /** Optional category for filtering on the full testimonials page */
  category: "engineering" | "devops" | "leadership" | "platform";
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Before VisgniteAI, our approval process lived across Slack threads and spreadsheets. Consolidating into one board cut review cycles from days to hours.",
    author: "Engineering Lead",
    role: "Engineering Lead",
    company: "Series B SaaS company",
    category: "engineering",
  },
  {
    quote:
      "Our team needed real-time visibility into which agents were healthy and which had silently failed. The health dashboard surfaced issues we didn't know existed.",
    author: "DevOps Manager",
    role: "DevOps Manager",
    company: "Enterprise software team",
    category: "devops",
  },
  {
    quote:
      "When you're coordinating agents across finance, legal, and product — having one orchestration layer instead of five disparate tools changes how quickly decisions happen.",
    author: "CTO",
    role: "CTO",
    company: "Growth-stage platform company",
    category: "leadership",
  },
  {
    quote:
      "Gateway management was our biggest scaling bottleneck. Being able to manage all routing rules from one control surface removed an entire class of handoff errors.",
    author: "Platform Engineer",
    role: "Platform Engineer",
    company: "Cloud infrastructure team",
    category: "platform",
  },
  {
    quote:
      "Routing all agent alerts through a single layer meant our on-call engineers stopped context-switching between dashboards. Response times improved measurably.",
    author: "SRE Team Lead",
    role: "SRE Team Lead",
    company: "FinTech engineering team",
    category: "devops",
  },
  {
    quote:
      "Regulated industries need audit trails without sacrificing deployment speed. Approval checkpoints in the workflow gave us both — compliance teams and engineers stopped fighting.",
    author: "VP of Engineering",
    role: "VP of Engineering",
    company: "Healthcare SaaS team",
    category: "leadership",
  },
  {
    quote:
      "Coordinating many agents across multiple boards requires a tool that doesn't collapse under operational complexity. This was the only platform that kept pace.",
    author: "Staff Engineer",
    role: "Staff Engineer",
    company: "AI research organization",
    category: "engineering",
  },
  {
    quote:
      "Distributed teams lose context constantly — who approved what, which agent ran when. A single source of truth for operational decisions removed those questions entirely.",
    author: "Head of Operations",
    role: "Head of Operations",
    company: "Remote-first agency",
    category: "leadership",
  },
  {
    quote:
      "We needed CI/CD integration without rebuilding our pipeline. The setup fit into our existing flow without a major lift — we were running in production within the first week.",
    author: "Senior DevOps Engineer",
    role: "Senior DevOps Engineer",
    company: "E-commerce platform team",
    category: "devops",
  },
];

/** Stats shown on the testimonials page hero */
export const TESTIMONIAL_STATS = [
  { value: "99.9%", label: "Platform uptime SLA" },
  { value: "< 1 min", label: "Median approval cycle time" },
  { value: "1 week", label: "Typical time-to-production" },
  { value: "SOC 2", label: "Security certification" },
] as const;
