export type ShowcaseStory = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  previewImageSrc: string;
  previewImageAlt: string;
  previewImageClassName?: string;
  highlights: string[];
};

export const SHOWCASE_STORIES: ShowcaseStory[] = [
  {
    id: "orchestrate",
    kicker: "Orchestrate",
    title: "Move from agent design to deployment inside one orchestration loop",
    description:
      "Helux brings builder configuration, deployment commands, and operational capabilities into one surface so teams can launch agents with less handoff friction.",
    ctaLabel: "Explore orchestration",
    ctaHref: "#",
    previewImageSrc: "/images/landing/helux-showcase-orchestrate-20260312.png",
    previewImageAlt:
      "Helux orchestration illustration showing an AI builder, deployment terminal, and capabilities card connected in one workflow.",
    previewImageClassName: "scale-[1.01]",
    highlights: ["AI builder", "Helux deploy", "Capabilities layer"],
  },
  {
    id: "build-integrate",
    kicker: "Observe and optimize",
    title: "Track operational workflow executions across every team",
    description:
      "Route Finance, Marketing, Law firm, and Product workflows into one mission control layer, then track execution volume and cluster health from a single overview.",
    ctaLabel: "Explore observability",
    ctaHref: "#",
    previewImageSrc: "/images/landing/helux-showcase-executions-20260312.png",
    previewImageAlt:
      "Helux execution illustration showing four business functions feeding a central orchestration node with analytics and deployment overview.",
    previewImageClassName: "",
    highlights: ["Finance to Product", "Execution analytics", "Cluster health"],
  },
  {
    id: "manage-scale",
    kicker: "Manage and scale",
    title: "Keep every workspace aligned with one governed execution pattern",
    description:
      "Assign board leads, enforce approval checkpoints, and monitor execution signals in one mission control layer as you scale teams.",
    ctaLabel: "Explore governance controls",
    ctaHref: "#",
    previewImageSrc: "/images/landing/helux-showcase-manage-scale-20260312.png",
    previewImageAlt:
      "Mission control visual showing board lead assignment, execution pipeline, operational tracking, and audit signals.",
    previewImageClassName: "scale-[1.06] -translate-x-[2%]",
    highlights: ["Board lead ownership", "Approval checkpoints", "Operational signals"],
  },
];
