"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRESCRIPTION_LABELS, type PrescriptionsData } from "@/lib/prescriptions";
import { shares2023, shares2024, type SimulatorFragment } from "@/lib/simulator";
import {
  buildSimulatorView,
  clampWeights,
  weightsFromShares,
  type SimulatorViewRow,
} from "@/lib/simulator-view";

const fmt1 = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const PRESCRIPTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  grow: "default",
  coast: "secondary",
  reduce_reliance: "outline",
};

function OutcomeCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * The live market-mix simulator (ticket #19). Sliders hold percent-point
 * weights per source market; effective shares are weight / total weight, so
 * the mix always renormalises and a zero total falls back to a uniform mix.
 * Every outcome recomputes at render time from the bundle's simulator
 * fragment via the pinned arithmetic in src/lib/simulator.ts.
 */
export function SimulatorClient({
  frag,
  prescriptions,
}: {
  frag: SimulatorFragment;
  prescriptions: PrescriptionsData;
}) {
  const [weights, setWeights] = useState<number[]>(() => weightsFromShares(shares2024(frag)));

  const view = useMemo(() => buildSimulatorView(frag, weights, prescriptions), [frag, weights, prescriptions]);

  const setWeight = (i: number, value: number) => {
    setWeights((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const resetTo = (shares: number[]) => setWeights(weightsFromShares(shares));
  const gapPositive = view.result.gap_2019_prices_rm_million >= 0;
  const chartData = view.rows.map((r) => ({
    market: r.market,
    "Receipts (RM million, 2019 prices)": r.contributionRmMillion,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Market-mix simulator</h1>
        <p className="text-sm text-muted-foreground">
          Move the sliders to change the mix of visitor source markets. Every
          outcome below recomputes instantly. All figures are in constant{" "}
          {frag.anchor_year} prices — gaps are quoted in {frag.anchor_year} prices only.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OutcomeCard
          title="Yield per visitor"
          value={`RM${fmt1(view.result.yield_per_visitor_real_rm)}`}
          note="constant 2019 RM per visitor"
        />
        <OutcomeCard
          title="Tourism receipts"
          value={`RM${fmt1(view.result.receipts_2019_prices_rm_million)}m`}
          note={`${frag.visitor_arrivals_2024.toLocaleString("en-US")} visitors · constant 2019 prices`}
        />
        <OutcomeCard
          title={`Counterfactual at the ${frag.anchor_year} anchor`}
          value={`RM${fmt1(view.result.counterfactual_2019_prices_rm_million)}m`}
          note="receipts if every visitor were worth a 2019 visitor"
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              The gap (positive = Missing Billions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              RM{fmt1(view.result.gap_2019_prices_rm_million)}m
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {gapPositive
                ? "This mix underperforms the 2019 anchor"
                : "This mix outperforms the 2019 anchor"}
              {" · constant "}
              {frag.anchor_year} prices
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Market mix · {view.mixLabel} vs {frag.anchor_year} anchor
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => resetTo(shares2024(frag))}>
                Reset to {frag.mix_year} observed mix
              </Button>
              <Button variant="outline" size="sm" onClick={() => resetTo(shares2023(frag))}>
                Reset to {frag.comparison_year} observed mix
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {frag.markets.map((m, i) => (
              <div key={m.market} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{m.market}</span>
                  <span className="text-muted-foreground">
                    {view.rows[i].sharePct.toFixed(1)}% of visitors · RM
                    {fmt1(m.yield_2024_real_2019_rm_per_visitor)} per visitor (
                    {frag.anchor_year} prices)
                  </span>
                </div>
                <Slider
                  aria-label={`${m.market} share of the visitor mix`}
                  min={0}
                  max={100}
                  step={1}
                  value={[clampWeights([weights[i]])[0]]}
                  onValueChange={(v: number[]) => setWeight(i, v[0] ?? 0)}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Sliders are weights, not percentages: the mix always renormalises,
              so pushing one market up lowers the others. All the way down on
              every slider gives a uniform mix.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Receipts by source market (RM million, {frag.anchor_year} prices)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => fmt1(v)}
                    fontSize={12}
                  />
                  <YAxis type="category" dataKey="market" width={90} fontSize={12} />
                  <Tooltip
                    formatter={(v) => [`RM${fmt1(Number(v))} million`, `Receipts (${frag.anchor_year} prices)`]}
                  />
                  <Bar dataKey={`Receipts (RM million, ${frag.anchor_year} prices)`} fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Per-market outcomes and prescriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source market</TableHead>
                <TableHead className="text-right">Share of visitors</TableHead>
                <TableHead className="text-right">
                  Yield per visitor ({frag.anchor_year} RM)
                </TableHead>
                <TableHead className="text-right">
                  Receipts (RM million, {frag.anchor_year} prices)
                </TableHead>
                <TableHead>Prescription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((row: SimulatorViewRow) => (
                <TableRow key={row.market}>
                  <TableCell className="font-medium">{row.market}</TableCell>
                  <TableCell className="text-right">{row.sharePct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">RM{fmt1(row.yieldReal2019)}</TableCell>
                  <TableCell className="text-right">RM{fmt1(row.contributionRmMillion)}m</TableCell>
                  <TableCell>
                    {row.prescription ? (
                      <Badge variant={PRESCRIPTION_BADGE_VARIANT[row.prescription]}>
                        {PRESCRIPTION_LABELS[row.prescription]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {prescriptions.available && (
            <p className="mt-3 text-xs text-muted-foreground">
              Prescriptions come from the machine-learning segmentation of
              source markets (clustered by yield and growth):{" "}
              <strong>Grow</strong> high-yield or fast-growing segments,{" "}
              <strong>Coast</strong> steady low-yield segments, and{" "}
              <strong>reduce reliance</strong> on the low-yield, high-volume
              same-day traffic the arrivals count over-rewards.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
