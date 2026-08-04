import { StandingsBoard, type Period, type StandingsBoardProps } from "./StandingsBoard";

export type StandingsBoardIslandProps = Omit<StandingsBoardProps, "onPeriodChange">;

// StandingsBoard's onPeriodChange is a function prop, which can't cross the
// Astro/React island boundary (island props must be JSON-serializable). This
// wrapper supplies it: since the page is server-rendered from bets/users
// data, switching period re-navigates with a query param rather than
// fetching client-side, consistent with the rest of the app's
// server-rendered, framework-light architecture.
export function StandingsBoardIsland(props: StandingsBoardIslandProps) {
  function onPeriodChange(period: Period) {
    if (period === props.period) return;
    const url = new URL(window.location.href);
    url.searchParams.set("period", period);
    window.location.href = url.toString();
  }

  return <StandingsBoard {...props} onPeriodChange={onPeriodChange} />;
}
