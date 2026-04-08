"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

type CoinSparklineProps = {
  points: number[];
  positive: boolean;
};

export function CoinSparkline({ points, positive }: CoinSparklineProps) {
  if (!points.length) {
    return <div className="h-10 w-28 rounded-lg bg-white/5" />;
  }

  const data = points.map((value, index) => ({ index, value }));

  return (
    <div className="h-10 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={positive ? "#16C47F" : "#FB7185"}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

