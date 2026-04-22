import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  Calendar,
  Users,
  TrendingUp,
  ListChecks,
  Package2,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/producao")({
  head: () => ({ meta: [{ title: "Motor de Produção — LLum" }] }),
  component: ProducaoPage,
});

function ProducaoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInsumos, setShowInsumos] = useState(true);

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens"],
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

  const { data: itens = [] } = useQuery({
    queryKey: ["ordem-itens", ordemAtiva?.id],
    enabled: !!ordemAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordem_itens")
        .select("*, fichas_tecnicas(nome, categoria, unidade_rendimento, cmv_por_porcao)")
        .eq("ordem_id", ordemAtiva!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Insumos consolidados previstos para a ordem (somando todas as fichas)
  const { data: insumosPrevistos = [] } = useQuery({
    queryKey: ["ordem-insumos-previstos", ordemAtiva?.id],
    enabled: !!ordemAtiva?.id && itens.length > 0,
    queryFn: async () => {
      const fichaIds = itens.map((i) => i.ficha_id);
      const [fichasRes, ingredRes, insumosRes] = await Promise.all([
        supabase.from("fichas_tecnicas").select("id, rendimento_porcoes").in("id", fichaIds),
        supabase
          .from("ficha_itens")
          .select("ficha_id, insumo_id, quantidade, unidade")
          .in("ficha_id", fichaIds),
        supabase
          .from("insumos")
          .select("id, nome, unidade, estoque_atual, custo_medio, ponto_reposicao"),
      ]);
      const fichas = new Map((fichasRes.data ?? []).map((f) => [f.id, Number(f.rendimento_porcoes)]));
      const insumosMap = new Map((insumosRes.data ?? []).map((i) => [i.id, i]));
      const agg = new Map<string, { qtd: number; custo: number }>();

      for (const it of itens) {
        const rend = fichas.get(it.ficha_id) ?? 1;
        const porcoes = Number(it.porcoes_previstas);
        const ingred = (ingredRes.data ?? []).filter((g) => g.ficha_id === it.ficha_id);
        for (const g of ingred) {
          const consumo = (Number(g.quantidade) / rend) * porcoes;
          const ins = insumosMap.get(g.insumo_id);
          if (!ins) continue;
          const cur = agg.get(g.insumo_id) ?? { qtd: 0, custo: 0 };
          cur.qtd += consumo;
          cur.custo += consumo * Number(ins.custo_medio);
          agg.set(g.insumo_id, cur);
        }
      }
      return Array.from(agg.entries())
        .map(([insumo_id, v]) => {
          const ins = insumosMap.get(insumo_id)!;
          const falta = v.qtd > Number(ins.estoque_atual);
          return {
            insumo_id,
            nome: ins.nome,
            unidade: ins.unidade,
            qtd_prevista: v.qtd,
            estoque_atual: Number(ins.estoque_atual),
            custo: v.custo,
            falta,
          };
        })
        .sort((a, b) => (a.falta === b.falta ? b.custo - a.custo : a.falta ? -1 : 1));
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Coração do sistema"
        title="Motor de produção"
        description="Da demanda do dia → ordem de produção da cozinha. O motor cruza fichas técnicas com parâmetros de consumo por pessoa para gerar quantidades e custo previsto."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-ember text-primary-foreground">
                <Sparkles className="h-4 w-4" /> Gerar ordem do dia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova ordem de produção</DialogTitle>
              </DialogHeader>
              <NovaOrdemForm
                onDone={(id) => {
                  setOpen(false);
                  setSelectedId(id);
                  qc.invalidateQueries({ queryKey: ["ordens"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Lista de ordens */}
        <Card className="border-border/60 bg-gradient-surface">
          <div className="border-b border-border/60 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ordens recentes
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
            {ordens.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sem ordens ainda. Gere a primeira.
              </div>
            )}
            {ordens.map((o) => {
              const active = ordemAtiva?.id === o.id;
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
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {o.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {o.pessoas_esperadas} pessoas · {brl(Number(o.custo_previsto))}
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
              <Sparkles className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Configure os <strong className="text-foreground">parâmetros de demanda</strong> e
                gere a primeira ordem de produção.
              </p>
            </Card>
          )}
          {ordemAtiva && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Mini icon={Calendar} label="Data" value={new Date(ordemAtiva.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")} />
                <Mini icon={Users} label="Pessoas" value={String(ordemAtiva.pessoas_esperadas)} />
                <Mini
                  icon={TrendingUp}
                  label="Custo previsto"
                  value={brl(Number(ordemAtiva.custo_previsto))}
                />
                <Mini
                  icon={Sparkles}
                  label="CMV previsto"
                  value={ordemAtiva.cmv_previsto_pct ? `${num(Number(ordemAtiva.cmv_previsto_pct), 1)}%` : "—"}
                />
              </div>

              <Card className="mt-6 border-border/60 bg-gradient-surface">
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-lg text-foreground">
                      Ordem para a cozinha — {itens.length} fichas
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Faturamento previsto:{" "}
                    {brl(ordemAtiva.pessoas_esperadas * Number(ordemAtiva.ticket_medio))}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {itens.length === 0 && (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                      Nenhum item gerado. Configure parâmetros de demanda em{" "}
                      <strong>/demanda</strong>.
                    </div>
                  )}
                  {itens.map((it) => (
                    <div key={it.id} className="grid grid-cols-1 gap-2 px-6 py-3 md:grid-cols-[1fr_120px_120px_140px] md:items-center">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {it.fichas_tecnicas?.nome}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {it.fichas_tecnicas?.categoria}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Produzir
                        </div>
                        <div className="text-lg font-display text-foreground tabular-nums">
                          {num(Number(it.porcoes_previstas))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {it.fichas_tecnicas?.unidade_rendimento}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          CMV/porção
                        </div>
                        <div className="text-sm tabular-nums text-muted-foreground">
                          {brl(Number(it.fichas_tecnicas?.cmv_por_porcao ?? 0))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Custo
                        </div>
                        <div className="text-sm font-medium tabular-nums text-foreground">
                          {brl(Number(it.custo_previsto))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Insumos previstos consolidados */}
              <Card className="mt-6 border-border/60 bg-gradient-surface">
                <button
                  type="button"
                  onClick={() => setShowInsumos((v) => !v)}
                  className="flex w-full items-center justify-between border-b border-border/60 px-6 py-4 text-left hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    <Package2 className="h-4 w-4 text-accent" />
                    <h3 className="font-display text-lg text-foreground">
                      Insumos previstos para separação — {insumosPrevistos.length} itens
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {insumosPrevistos.some((i) => i.falta) && (
                      <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                        {insumosPrevistos.filter((i) => i.falta).length} em falta
                      </span>
                    )}
                    <Link
                      to="/separacao"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ClipboardList className="h-3 w-3" /> Abrir separação
                    </Link>
                    {showInsumos ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                {showInsumos && (
                  <div className="divide-y divide-border/50">
                    {insumosPrevistos.length === 0 && (
                      <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                        Nenhum insumo cadastrado nas fichas desta ordem.
                      </div>
                    )}
                    {insumosPrevistos.map((ins) => (
                      <div
                        key={ins.insumo_id}
                        className="grid grid-cols-1 gap-2 px-6 py-3 md:grid-cols-[1fr_140px_140px_120px] md:items-center"
                      >
                        <div className="text-sm font-medium text-foreground">{ins.nome}</div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Necessário
                          </div>
                          <div
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              ins.falta ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {num(ins.qtd_prevista, 3)} {ins.unidade}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Em estoque
                          </div>
                          <div className="text-sm tabular-nums text-muted-foreground">
                            {num(ins.estoque_atual, 3)} {ins.unidade}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Custo
                          </div>
                          <div className="text-sm tabular-nums text-foreground">
                            {brl(ins.custo)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NovaOrdemForm({ onDone }: { onDone: (id: string) => void }) {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [pessoas, setPessoas] = useState("200");
  const [ticket, setTicket] = useState("89.90");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(pessoas);
    const t = Number(ticket);
    if (!p || p <= 0) {
      toast.error("Informe quantidade de pessoas");
      return;
    }
    setSaving(true);
    const { data: result, error } = await supabase.rpc("gerar_ordem_producao", {
      _data: data,
      _pessoas: p,
      _ticket: t,
      _origem: "manual",
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    if (obs && result) {
      await supabase
        .from("ordens_producao")
        .update({ observacoes: obs })
        .eq("id", result as string);
    }
    setSaving(false);
    toast.success("Ordem de produção gerada");
    onDone(result as string);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Data da operação</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </div>
        <div>
          <Label>Pessoas esperadas *</Label>
          <Input
            type="number"
            min="1"
            value={pessoas}
            onChange={(e) => setPessoas(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Ticket médio (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="ex.: feriado, chuva prevista, evento corporativo..."
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 bg-gradient-ember text-primary-foreground"
        >
          <Sparkles className="h-4 w-4" />
          {saving ? "Calculando..." : "Gerar ordem"}
        </Button>
      </div>
    </form>
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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-lg text-foreground tabular-nums truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
