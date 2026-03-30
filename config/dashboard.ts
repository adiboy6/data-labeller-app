import { DashboardConfig } from "types"

export const dashboardConfig: DashboardConfig = {
  mainNav: [
    // {
    //   title: "About",
    //   href: "/about",
    // },
    // {
    //   title: "Blog",
    //   href: "/blog",
    // },
    // {
    //   title: "Leaderboard",
    //   href: "/leaderboard",
    // },
    // {
    //   title: "Support",
    //   href: "/support",
    //   disabled: true,
    // },
  ],
  sidebarNav: [
    {
      title: "Quiz Home",
      href: "/dashboard",
      icon: "post",
    },
    {
      title: "Review",
      href: "/dashboard/review",
      icon: "clipboardCheck",
    },
    {
      title: "Question Bank",
      href: "/dashboard/questions",
      icon: "book",
    },
    // {
    //   title: "Settings",
    //   href: "/dashboard/settings",
    //   icon: "settings",
    // },
  ],
}
