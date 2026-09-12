import type { Metadata } from "next";
import Link from "next/link";
import "./claims.css";

export const metadata: Metadata = {
  title: "Claims dashboard · Officer workspace",
  description: "Review vehicle claims and move each case forward.",
};

export default function ClaimsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="claims-shell">
      <header className="site-header">
        <Link href="/claims">Officer workspace</Link>
        <div className="site-header-end">
          <Link className="secondary" href="/">
            Home
          </Link>
          <span>Live backend · Vehicle claims</span>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        Officer workspace · Actions persist to Postgres.
      </footer>
    </div>
  );
}
