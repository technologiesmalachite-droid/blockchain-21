"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { portfolioSeries } from "@/data/demo";

export function PortfolioChart() {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={portfolioSeries}>
          <defs>
            <linearGradient id="portfolio" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#16C47F" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#16C47F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }} />
          <Area type="monotone" dataKey="value" stroke="#16C47F" strokeWidth={3} fill="url(#portfolio)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

