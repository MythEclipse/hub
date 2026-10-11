import { createFileRoute } from "@tanstack/react-router";
import { PortfolioSheet } from "#/components/portfolio/portfolio-sheet";

export const Route = createFileRoute("/$locale/")({
  component: PortfolioSheet,
});
