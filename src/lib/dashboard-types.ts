export type DashboardSnapshot = Awaited<
  ReturnType<typeof import("@/lib/db/queries").getDashboardSnapshot>
>;

export type DashboardCard = DashboardSnapshot["cards"][number];
export type DashboardActivity = DashboardSnapshot["activityEntries"][number];
