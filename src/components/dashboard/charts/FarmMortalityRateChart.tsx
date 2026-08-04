import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../ChartCard";
import { getMortalityRate, MORTALITY_TARGET_RATE } from "../../../services/farmDashboardService";
import { axisTick, gridProps, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "./chartTheme";

export default function FarmMortalityRateChart() {
  const data = getMortalityRate();

  return (
    <ChartCard title="Mortality Rate" subtitle={`This year, target ≤ ${MORTALITY_TARGET_RATE}%`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
          <ReferenceLine
            y={MORTALITY_TARGET_RATE}
            stroke="var(--chart-baseline)"
            strokeDasharray="4 4"
            label={{ value: "Target", position: "insideTopRight", fill: "var(--chart-muted)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value) => [`${value}%`, "Mortality"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-series-8)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
