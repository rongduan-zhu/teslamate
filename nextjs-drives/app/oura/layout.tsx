import type { ReactNode } from "react";

const pageStyle = {
  width: "min(760px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "48px 0 72px",
  color: "#172033",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  lineHeight: 1.65,
} as const;

const navStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  marginBottom: "40px",
} as const;

export default function OuraDisclosureLayout({ children }: { children: ReactNode }) {
  return (
    <main style={pageStyle}>
      <nav aria-label="Personal Health Archive">
        <div style={navStyle}>
          <a href="/oura">About</a>
          <a href="/oura/privacy">Privacy</a>
          <a href="/oura/terms">Terms</a>
        </div>
      </nav>
      {children}
    </main>
  );
}
