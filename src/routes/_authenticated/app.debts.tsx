import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/debts")({
  beforeLoad: () => { throw redirect({ to: "/app/people" }); },
  component: () => null,
});
