// Tela /estoque — controle literal completo do estoque
// Tabela principal com TODOS os insumos: estoque atual, ponto reposição, custo médio,
// valor em estoque, status (ok/baixo/crítico). Filtros + ações inline + KPIs no topo.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Boxes,
  AlertTriangle,
  Package2,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  History,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type TipoMov = Database["public"]["Enums"]["tipo_movimento"];

const TIPO_LABEL: Record<TipoMov, string> = {
  entrada_compra: "Entrada (compra)",
  saida_producao: "Saída (produção)",
  ajuste_inventario: "Ajuste inventário",
  perda: "Perda",
  transferencia: "Transferência",
};

type Insumo = {
  id: string;
  nome: string;
  unidade: string;
  custo_medio: number;
  estoque_atual: number;
  ponto_reposicao: number;
  categoria: string | null;
  fornecedor_id: string | null;
  fornecedores: { nome: string } | null;
};

export const Route = createFileRoute("/_app/estoque")({
  head: () => ({ meta: [{ title: "Estoque — LLUM OS" }] }),
  component: EstoquePage,
});

function statusOf(i: Insumo): "ok" | "baixo" | "ruptura" {
  if (Number(i.estoque_atual) <= 0) return "ruptura";
  if (Number(i.estoque_atual) <= Number(i.ponto_reposicao)) return "baixo";
  return "ok";
}

function EstoquePage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "baixo" | "ruptura">("todos");
  const [movOpen, setMovOpen] = useState(false);
  const [movInsumo, setMovInsumo] = useState<Insumo | null>(null);

  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select(
          "id, nome, unidade, custo_medio, estoque_atual, ponto_reposicao, categoria, fornecedor_id, fornecedores(nome)",
        )
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Insumo[];
    },
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ["movimentos-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentos_estoque")
        .select("*, insumos(nome, unidade), fornecedores(nome)")
        .order("data_movimento", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return insumos.filter((i) => {
      if (q && !i.nome.toLowerCase().includes(q) && !(i.categoria ?? "").toLowerCase().includes(q)) return false;
      const s = statusOf(i);
      if (filtro === "baixo" && s !== "baixo") return false;
      if (filtro === "ruptura" && s !== "ruptura") return false;
      return true;
    });
  }, [insumos, busca, filtro]);

  const stats = useMemo(() => {
    const valor = insumos.reduce((a, i) => a + Number(i.estoque_atual) * Number(i.custo_medio), 0);
    const ruptura = insumos.filter((i) => statusOf(i) === "ruptura").length;
    const baixo = insumos.filter((i) => statusOf(i) === "baixo").length;
    return { valor, ruptura, baixo, total: insumos.length };
  }, [insumos]);

  function abrirMov(i: Insumo) {
    setMovInsumo(i);
    setMovOpen(true);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operação · Estoque"
        title="Controle de estoque"
        description="Saldo em tempo real, custo médio ponderado e ações por insumo."
        actions={
          <Dialog open={movOpen} onOpenChange={(o) => { setMovOpen(o); if (!o) setMovInsumo(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary-glow">
                <Plus className="h-4 w-4" /> Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar movimentação</DialogTitle>
              </DialogHeader>
              <MovimentoForm
                insumos={insumos}
                fornecedores={fornecedores}
                preSel={movInsumo}
                onDone={() => {
                  setMovOpen(false);
                  setMovInsumo(null);
                  qc.invalidateQueries({ queryKey: ["insumos-estoque"] });
                  qc.invalidateQueries({ queryKey: ["movimentos-estoque"] });
                  qc.invalidateQueries({ queryKey: ["alertas-estoque"] });
                  qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4 mb-6">
        <Kpi icon={Package2} label="Valor em estoque" value={brl(stats.valor)} hint={`${stats.total} insumos ativos`} accent="primary" />
        <Kpi icon={Boxes} label="Itens monitorados" value={String(stats.total)} hint="Cadastrados e ativos" accent="muted" />
        <Kpi icon={TrendingDown} label="Estoque baixo" value={String(stats.baixo)} hint="≤ ponto de reposição" accent={stats.baixo > 0 ? "warning" : "muted"} />
        <Kpi icon={AlertTriangle} label="Em ruptura" value={String(stats.ruptura)} hint="Estoque zerado" accent={stats.ruptura > 0 ? "destructive" : "muted"} />
      </div>

      <Tabs defaultValue="balanco" className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="balanco" className="data-[state=active]:bg-elevated">
            <Boxes className="h-3.5 w-3.5 mr-1.5" /> Balanço atual
          </TabsTrigger>
          <TabsTrigger value="movimentos" className="data-[state=active]:bg-elevated">
            <History className="h-3.5 w-3.5 mr-1.5" /> Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balanco" className="mt-4">
          <Card className="border-border bg-card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar insumo ou categoria..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 h-9 bg-elevated border-border"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["todos", "baixo", "ruptura"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltro(f)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors capitalize",
                      filtro === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-elevated",
                    )}
                  >
                    {f === "todos" ? "Todos" : f === "baixo" ? "Baixo" : "Ruptura"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-medium">Insumo</th>
                    <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">Fornecedor</th>
                    <th className="px-3 py-2.5 text-right font-medium">Estoque</th>
                    <th className="px-3 py-2.5 text-right font-medium hidden md:table-cell">Mín.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Custo méd.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                    <th className="px-3 py-2.5 text-center font-medium">Status</th>
                    <th className="px-5 py-2.5 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                        Nenhum insumo encontrado.
                      </td>
                    </tr>
                  )}
                  {filtrados.map((i) => {
                    const s = statusOf(i);
                    const valor = Number(i.estoque_atual) * Number(i.custo_medio);
                    return (
                      <tr key={i.id} className="border-b border-border/50 hover:bg-elevated/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-foreground">{i.nome}</div>
                          {i.categoria && (
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{i.categoria}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {i.fornecedores?.nome ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground">
                          {num(Number(i.estoque_atual))} <span className="text-muted-foreground text-[11px]">{i.unidade}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground hidden md:table-cell">
                          {num(Number(i.ponto_reposicao))}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {brl(Number(i.custo_medio))}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground">
                          {brl(valor)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <StatusPill status={s} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirMov(i)}
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Wrench className="h-3 w-3" />
                            Movimentar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtrados.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border bg-elevated/40">
                      <td colSpan={5} className="px-5 py-2.5 text-xs text-muted-foreground">
                        {filtrados.length} de {insumos.length} insumos
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-sm font-semibold text-foreground">
                        {brl(filtrados.reduce((a, i) => a + Number(i.estoque_atual) * Number(i.custo_medio), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="movimentos" className="mt-4">
          <Card className="border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="font-display text-base text-foreground">Últimas 80 movimentações</h3>
            </div>
            <div className="divide-y divide-border">
              {movimentos.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação registrada.
                </div>
              )}
              {movimentos.map((m: any) => {
                const isEntrada = m.tipo === "entrada_compra";
                return (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md shrink-0",
                        isEntrada ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {isEntrada ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{m.insumos?.nome ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {TIPO_LABEL[m.tipo as TipoMov]}
                        {m.fornecedores?.nome ? ` · ${m.fornecedores.nome}` : ""}
                        {" · "}
                        {new Date(m.data_movimento).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-medium text-foreground">
                        {isEntrada ? "+" : "−"}
                        {num(Number(m.quantidade))} {m.insumos?.unidade}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {Number(m.custo_total) > 0 ? brl(Number(m.custo_total)) : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusPill({ status }: { status: "ok" | "baixo" | "ruptura" }) {
  const cfg = {
    ok: "bg-success/15 text-success",
    baixo: "bg-warning/15 text-warning",
    ruptura: "bg-destructive/15 text-destructive",
  };
  const label = { ok: "OK", baixo: "Baixo", ruptura: "Ruptura" };
  return (
    <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", cfg[status])}>
      {label[status]}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent: "primary" | "warning" | "destructive" | "muted";
}) {
  const map = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5 border-border bg-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1.5 font-display text-2xl text-foreground tabular-nums truncate">{value}</div>
          <div className="mt-1 text-[11px] text-muted-foreground truncate">{hint}</div>
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md shrink-0", map[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function MovimentoForm({
  insumos,
  fornecedores,
  preSel,
  onDone,
}: {
  insumos: Array<{ id: string; nome: string; unidade: string; custo_medio: number }>;
  fornecedores: Array<{ id: string; nome: string }>;
  preSel: Insumo | null;
  onDone: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMov>("entrada_compra");
  const [insumoId, setInsumoId] = useState(preSel?.id ?? "");
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const insumoSel = insumos.find((i) => i.id === insumoId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!insumoId || !quantidade) {
      toast.error("Insumo e quantidade são obrigatórios");
      return;
    }
    const qtd = Number(quantidade);
    const custo = Number(custoUnitario || 0);
    if (Number.isNaN(qtd) || qtd === 0) {
      toast.error("Quantidade inválida");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("movimentos_estoque").insert({
      insumo_id: insumoId,
      tipo,
      quantidade: tipo === "ajuste_inventario" ? qtd : Math.abs(qtd),
      custo_unitario: custo,
      custo_total: custo * Math.abs(qtd),
      fornecedor_id: fornecedorId || null,
      documento: documento || null,
      observacoes: observacoes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Movimentação registrada");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMov)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABEL) as TipoMov[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Insumo *</Label>
          <Select value={insumoId} onValueChange={setInsumoId}>
            <SelectTrigger><SelectValue placeholder="Selecionar insumo" /></SelectTrigger>
            <SelectContent>
              {insumos.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.nome} ({i.unidade})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>
            Quantidade {insumoSel ? `(${insumoSel.unidade})` : ""}
            {tipo === "ajuste_inventario" && (
              <span className="ml-1 text-[10px] text-muted-foreground">+/− permitido</span>
            )}
          </Label>
          <Input
            type="number"
            step="0.001"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Custo unitário (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={custoUnitario}
            onChange={(e) => setCustoUnitario(e.target.value)}
            placeholder={insumoSel ? `Médio: ${brl(Number(insumoSel.custo_medio))}` : ""}
          />
        </div>
        {tipo === "entrada_compra" && (
          <>
            <div>
              <Label>Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Documento / NF</Label>
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
          </>
        )}
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary-glow">
          {saving ? "Registrando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
