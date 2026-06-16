import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/debts/$id")({
  beforeLoad: () => { throw redirect({ to: "/app/people" }); },
  component: () => null,
});
