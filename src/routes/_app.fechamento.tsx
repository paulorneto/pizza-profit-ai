import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Trash2,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/fechamento")({
  head: () => ({ meta: [{ title: "Fechamento do dia — LLum" }] }),
  component: FechamentoPage,
});

function FechamentoPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ordens em aberto (não concluídas) + concluídas recentes
  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens-fechamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("*")
        .order("data_operacao", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const ordemAtiva = ordens.find((o) => o.id === selectedId) ?? ordens[0];
  const isConcluida = ordemAtiva?.status === "concluida";

  const { data: itens = [] } = useQuery({
    queryKey: ["fechamento-itens", ordemAtiva?.id],
    enabled: !!ordemAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordem_itens")
        .select("*, fichas_tecnicas(nome, categoria, unidade_rendimento)")
        .eq("ordem_id", ordemAtiva!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: fechamento } = useQuery({
    queryKey: ["fechamento", ordemAtiva?.id],
    enabled: !!ordemAtiva?.id && isConcluida,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos_dia")
        .select("*")
        .eq("ordem_id", ordemAtiva!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Real x Previsto"
        title="Fechamento operacional do dia"
        description="Registre pessoas reais, faturamento e sobras. O sistema baixa o estoque consumido, calcula CMV real e o acerto da previsão."
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Lista de ordens */}
        <Card className="border-border/60 bg-gradient-surface">
          <div className="border-b border-border/60 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ordens
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
            {ordens.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma ordem ainda.
              </div>
            )}
            {ordens.map((o) => {
              const active = ordemAtiva?.id === o.id;
              const done = o.status === "concluida";
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    active ? "bg-primary/10" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground tabular-nums">
                      {new Date(o.data_operacao + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-amber-400">
                        aberta
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {o.pessoas_esperadas} esperadas · {brl(Number(o.custo_previsto))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Detalhe */}
        <div>
          {!ordemAtiva && (
            <Card className="p-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Selecione ou gere uma ordem de produção em <strong>/producao</strong>.
              </p>
            </Card>
          )}

          {ordemAtiva && isConcluida && fechamento && (
            <FechamentoConcluido
              ordem={ordemAtiva}
              fechamento={fechamento}
              itens={itens}
            />
          )}

          {ordemAtiva && !isConcluida && (
            <FechamentoForm
              ordem={ordemAtiva}
              itens={itens}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["ordens-fechamento"] });
                qc.invalidateQueries({ queryKey: ["fechamento", ordemAtiva.id] });
                qc.invalidateQueries({ queryKey: ["fechamento-itens", ordemAtiva.id] });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ================== FORM DE FECHAMENTO ==================
function FechamentoForm({
  ordem,
  itens,
  onDone,
}: {
  ordem: any;
  itens: any[];
  onDone: () => void;
}) {
  const [pessoas, setPessoas] = useState<string>(String(ordem.pessoas_esperadas));
  const [faturamento, setFaturamento] = useState<string>(
    String((ordem.pessoas_esperadas * Number(ordem.ticket_medio)).toFixed(2)),
  );
  const [obs, setObs] = useState<string>("");
  const [linhas, setLinhas] = useState<Record<string, { consumidas: string; sobras: string }>>({});
  const [saving, setSaving] = useState(false);

  // Inicializa linhas com porções previstas como padrão de consumo
  useEffect(() => {
    const init: Record<string, { consumidas: string; sobras: string }> = {};
    for (const it of itens) {
      init[it.id] = {
        consumidas: String(Number(it.porcoes_previstas)),
        sobras: "0",
      };
    }
    setLinhas(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length, ordem.id]);

  const ticketReal = useMemo(() => {
    const p = Number(pessoas);
    const f = Number(faturamento);
    return p > 0 ? f / p : 0;
  }, [pessoas, faturamento]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(pessoas);
    const f = Number(faturamento);
    if (!p || p <= 0) return toast.error("Informe pessoas reais");
    if (f < 0) return toast.error("Faturamento inválido");

    const itens_reais = itens.map((it) => ({
      ordem_item_id: it.id,
      porcoes_consumidas: Number(linhas[it.id]?.consumidas ?? 0),
      sobras: Number(linhas[it.id]?.sobras ?? 0),
    }));

    setSaving(true);
    const { error } = await supabase.rpc("fechar_ordem_producao", {
      _ordem_id: ordem.id,
      _pessoas_reais: p,
      _faturamento_real: f,
      _itens_reais: itens_reais as any,
      _observacoes: obs || undefined,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dia fechado · estoque atualizado");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Resumo previsto */}
      <div className="grid gap-4 md:grid-cols-4">
        <Mini icon={Calendar} label="Data" value={new Date(ordem.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")} />
        <Mini icon={Users} label="Pessoas previstas" value={String(ordem.pessoas_esperadas)} />
        <Mini icon={DollarSign} label="Custo previsto" value={brl(Number(ordem.custo_previsto))} />
        <Mini
          icon={Target}
          label="CMV previsto"
          value={ordem.cmv_previsto_pct ? `${num(Number(ordem.cmv_previsto_pct), 1)}%` : "—"}
        />
      </div>

      {/* Inputs reais */}
      <Card className="border-border/60 bg-gradient-surface p-6">
        <h3 className="font-display text-lg text-foreground">Números reais do dia</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <Label>Pessoas atendidas *</Label>
            <Input
              type="number"
              min="1"
              value={pessoas}
              onChange={(e) => setPessoas(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Faturamento real (R$) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Ticket médio real</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm tabular-nums text-foreground">
              {brl(ticketReal)}
            </div>
          </div>
        </div>
      </Card>

      {/* Consumo por ficha */}
      <Card className="border-border/60 bg-gradient-surface">
        <div className="border-b border-border/60 px-6 py-4">
          <h3 className="font-display text-lg text-foreground">
            Consumo real por ficha
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste quantas porções foram efetivamente consumidas e o que sobrou (vai pro
            descarte). O sistema baixa o estoque proporcionalmente.
          </p>
        </div>
        <div className="divide-y divide-border/50">
          {itens.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Esta ordem não tem itens.
            </div>
          )}
          {itens.map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-1 gap-3 px-6 py-3 md:grid-cols-[1fr_140px_140px_140px] md:items-center"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {it.fichas_tecnicas?.nome}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Previsto: {num(Number(it.porcoes_previstas))} {it.fichas_tecnicas?.unidade_rendimento}
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">
                  Consumidas
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={linhas[it.id]?.consumidas ?? ""}
                  onChange={(e) =>
                    setLinhas((p) => ({
                      ...p,
                      [it.id]: {
                        consumidas: e.target.value,
                        sobras: p[it.id]?.sobras ?? "0",
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Sobras
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={linhas[it.id]?.sobras ?? ""}
                  onChange={(e) =>
                    setLinhas((p) => ({
                      ...p,
                      [it.id]: {
                        consumidas: p[it.id]?.consumidas ?? "0",
                        sobras: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Custo previsto
                </div>
                <div className="text-sm font-medium tabular-nums text-foreground">
                  {brl(Number(it.custo_previsto))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <Label>Observações do dia</Label>
        <Textarea
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="ex.: chuva forte derrubou o movimento, evento corporativo aumentou..."
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 bg-gradient-ember text-primary-foreground"
        >
          <CheckCircle2 className="h-4 w-4" />
          {saving ? "Fechando..." : "Fechar dia e baixar estoque"}
        </Button>
      </div>
    </form>
  );
}

// ================== VISUALIZAÇÃO PÓS-FECHAMENTO ==================
function FechamentoConcluido({
  ordem,
  fechamento,
  itens,
}: {
  ordem: any;
  fechamento: any;
  itens: any[];
}) {
  const cmvPrev = Number(ordem.cmv_previsto_pct ?? 0);
  const cmvReal = Number(fechamento.cmv_real_pct ?? 0);
  const cmvDelta = cmvReal - cmvPrev;

  const custoPrev = Number(ordem.custo_previsto);
  const custoReal = Number(fechamento.custo_real);
  const custoDelta = custoReal - custoPrev;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Ordem concluída · fechada em{" "}
          {new Date(fechamento.created_at).toLocaleString("pt-BR")}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Pessoas"
          previsto={String(ordem.pessoas_esperadas)}
          real={String(fechamento.pessoas_reais)}
          acertoPct={Number(fechamento.acerto_pessoas_pct ?? 0)}
        />
        <KpiCard
          label="Faturamento"
          previsto={brl(ordem.pessoas_esperadas * Number(ordem.ticket_medio))}
          real={brl(Number(fechamento.faturamento_real))}
        />
        <KpiCard
          label="Custo (CMV R$)"
          previsto={brl(custoPrev)}
          real={brl(custoReal)}
          deltaInverso
          deltaValue={custoDelta}
        />
        <KpiCard
          label="CMV %"
          previsto={`${num(cmvPrev, 1)}%`}
          real={`${num(cmvReal, 1)}%`}
          deltaInverso
          deltaValue={cmvDelta}
          deltaSuffix="pp"
        />
      </div>

      <Card className="border-border/60 bg-gradient-surface p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Ticket médio real" value={brl(Number(fechamento.ticket_real))} />
          <Stat
            label="Sobras totais"
            value={`${num(Number(fechamento.sobras_total_kg), 2)}`}
          />
          <Stat
            label="Acerto da previsão (custo)"
            value={`${num(Number(fechamento.acerto_custo_pct ?? 0), 1)}%`}
          />
        </div>
      </Card>

      <Card className="border-border/60 bg-gradient-surface">
        <div className="border-b border-border/60 px-6 py-4">
          <h3 className="font-display text-lg text-foreground">Real x Previsto por ficha</h3>
        </div>
        <div className="divide-y divide-border/50">
          {itens.map((it) => {
            const prev = Number(it.porcoes_previstas);
            const cons = Number(it.porcoes_consumidas ?? 0);
            const sob = Number(it.sobras ?? 0);
            const acerto = prev > 0 ? 100 - (Math.abs(cons - prev) / prev) * 100 : 0;
            return (
              <div
                key={it.id}
                className="grid grid-cols-1 gap-2 px-6 py-3 md:grid-cols-[1fr_100px_100px_100px_120px] md:items-center"
              >
                <div className="text-sm font-medium text-foreground">
                  {it.fichas_tecnicas?.nome}
                </div>
                <Stat label="Previsto" value={num(prev)} compact />
                <Stat label="Consumido" value={num(cons)} compact />
                <Stat label="Sobras" value={num(sob)} compact />
                <Stat
                  label="Acerto"
                  value={`${num(acerto, 1)}%`}
                  compact
                  positive={acerto >= 85}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {fechamento.observacoes && (
        <Card className="border-border/60 bg-gradient-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Observações
          </div>
          <div className="mt-1 text-sm text-foreground">{fechamento.observacoes}</div>
        </Card>
      )}
    </div>
  );
}

// ================== HELPERS ==================
function KpiCard({
  label,
  previsto,
  real,
  acertoPct,
  deltaValue,
  deltaSuffix,
  deltaInverso,
}: {
  label: string;
  previsto: string;
  real: string;
  acertoPct?: number;
  deltaValue?: number;
  deltaSuffix?: string;
  deltaInverso?: boolean;
}) {
  const Up = TrendingUp;
  const Down = TrendingDown;
  let badge: React.ReactNode = null;
  if (typeof acertoPct === "number") {
    const ok = acertoPct >= 85;
    badge = (
      <span
        className={`text-xs tabular-nums ${ok ? "text-emerald-400" : "text-amber-400"}`}
      >
        acerto {num(acertoPct, 1)}%
      </span>
    );
  } else if (typeof deltaValue === "number") {
    const positivo = deltaInverso ? deltaValue <= 0 : deltaValue >= 0;
    const Icon = deltaValue >= 0 ? Up : Down;
    badge = (
      <span
        className={`flex items-center gap-1 text-xs tabular-nums ${positivo ? "text-emerald-400" : "text-rose-400"}`}
      >
        <Icon className="h-3 w-3" />
        {deltaValue >= 0 ? "+" : ""}
        {num(deltaValue, 1)}
        {deltaSuffix ?? ""}
      </span>
    );
  }
  return (
    <Card className="border-border/60 bg-gradient-surface p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground">Previsto</div>
          <div className="font-display text-lg text-muted-foreground tabular-nums">
            {previsto}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Real</div>
          <div className="font-display text-lg text-foreground tabular-nums">{real}</div>
        </div>
      </div>
      {badge && <div className="mt-2">{badge}</div>}
    </Card>
  );
}

function Stat({
  label,
  value,
  compact,
  positive,
}: {
  label: string;
  value: string;
  compact?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={compact ? "text-right md:text-right" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`tabular-nums ${compact ? "text-sm" : "font-display text-xl"} ${
          positive ? "text-emerald-400" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4 bg-gradient-surface border-border/60">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-lg text-foreground tabular-nums truncate">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
