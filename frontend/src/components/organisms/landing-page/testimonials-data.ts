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
      "VisgniteAI unified our board operations. Approvals that took days now take minutes.",
    author: "Sarah Chen",
    role: "Engineering Lead",
    company: "Series B Startup",
    category: "engineering",
  },
  {
    quote:
      "The agent health dashboard gives us real-time visibility we never had before.",
    author: "Marcus Rivera",
    role: "DevOps Manager",
    company: "Enterprise SaaS",
    category: "devops",
  },
  {
    quote:
      "Finally, one place to track tasks, agents, and decisions across all our teams.",
    author: "David Park",
    role: "CTO",
    company: "Growth-stage Platform",
    category: "leadership",
  },
  {
    quote:
      "Gateway management used to be our biggest bottleneck. VisgniteAI made it seamless with one control surface.",
    author: "Priya Sharma",
    role: "Platform Engineer",
    company: "Cloud Infrastructure Co.",
    category: "platform",
  },
  {
    quote:
      "We cut our incident response time by 60% after routing all agent alerts through VisgniteAI.",
    author: "James Wu",
    role: "SRE Team Lead",
    company: "FinTech Scale-up",
    category: "devops",
  },
  {
    quote:
      "The approval workflows let us maintain compliance without slowing down our engineering velocity.",
    author: "Elena Kowalski",
    role: "VP of Engineering",
    company: "Healthcare SaaS",
    category: "leadership",
  },
  {
    quote:
      "Running 200+ agents across 12 boards — VisgniteAI is the only tool that keeps it all visible.",
    author: "Alex Tanaka",
    role: "Staff Engineer",
    company: "AI Research Lab",
    category: "engineering",
  },
  {
    quote:
      "Our distributed teams finally have a single source of truth for every operational decision.",
    author: "Nina Johansson",
    role: "Head of Operations",
    company: "Remote-first Agency",
    category: "leadership",
  },
  {
    quote:
      "Integration with our existing CI/CD pipeline was surprisingly straightforward. Production-ready in a week.",
    author: "Rafael Costa",
    role: "Senior DevOps Engineer",
    company: "E-commerce Platform",
    category: "devops",
  },
];

/** Stats shown on the testimonials page hero */
export const TESTIMONIAL_STATS = [
  { value: "120+", label: "Teams using VisgniteAI" },
  { value: "99.5%", label: "Platform uptime" },
  { value: "28%", label: "Faster incident response" },
  { value: "4.6/5", label: "Average satisfaction score" },
] as const;
