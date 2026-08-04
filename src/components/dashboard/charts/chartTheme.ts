import type { CSSProperties } from "react";

/** Shared Recharts styling so every chart on the Overview page reads as one system. */

export const axisTick = { fill: "var(--chart-muted)", fontSize: 11 };

export const gridProps = {
  stroke: "var(--chart-grid)",
  strokeDasharray: "0",
  vertical: false,
};

export const tooltipContentStyle: CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  fontSize: 12,
  padding: "8px 10px",
};

export const tooltipLabelStyle: CSSProperties = {
  color: "var(--color-foreground)",
  fontWeight: 600,
  marginBottom: 2,
};

export const tooltipItemStyle: CSSProperties = {
  color: "var(--chart-text-secondary)",
};

export const legendWrapperStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--chart-text-secondary)",
};
