import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lodge a claim — Claimaroo",
  description:
    "Show us the damage, then talk us through what happened. Voice-first motor claims intake.",
};

export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
