import { createFileRoute } from "@tanstack/react-router";
import { InspectionSheet } from "#/components/dashboard/inspection-sheet";

export const Route = createFileRoute("/$locale/dashboard")({
  component: InspectionSheet,
});
