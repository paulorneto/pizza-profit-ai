// Tela /baixa — PDV de baixa rápida de insumos para tablet na cozinha/pizzaria
// Equipe busca o insumo, digita a quantidade no teclado numérico e confirma.
// Cada baixa = 1 movimento de "saida_producao".

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Check, X, Delete, Loader2, Package2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/baixa")({
  head: () => ({ meta: [{ title: "Baixa rápida — LLUM OS" }] }),
  component: BaixaPage,
});

type Insumo = {
  id: string;
  nome: string;
  unidade: string;
  custo_medio: number;
  estoque_atual: number;
  ponto_reposicao: number;
};

function BaixaPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Insumo | null>(null);
  const [qtd, setQtd] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos-baixa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nome, unidade, custo_medio, estoque_atual, ponto_reposicao")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Insumo[];
    },
  });

  const { data: ultimasBaixas = [] } = useQuery({
    queryKey: ["ultimas-baixas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentos_estoque")
        .select("id, quantidade, custo_total, data_movimento, insumos(nome, unidade)")
        .eq("tipo", "saida_producao")
        .order("data_movimento", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return insumos.slice(0, 18);
    return insumos
      .filter((i) => i.nome.toLowerCase().includes(q))
      .slice(0, 30);
  }, [insumos, busca]);

  const tap = (k: string) => {
    if (k === "C") {
      setQtd("");
      return;
    }
    if (k === "back") {
      setQtd((q) => q.slice(0, -1));
      return;
    }
    if (k === "." && qtd.includes(".")) return;
    if (k === "." && qtd === "") {
      setQtd("0.");
      return;
    }
    setQtd((q) => (q + k).slice(0, 8));
  };

  async function confirmar() {
    if (!selecionado) {
      toast.error("Selecione um insumo");
      return;
    }
    const q = Number(qtd);
    if (!q || q <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    if (q > selecionado.estoque_atual) {
      toast.warning(
        `Atenção: baixa (${q}) maior que o estoque atual (${selecionado.estoque_atual})`,
      );
    }
    setSalvando(true);
    const { error } = await supabase.from("movimentos_estoque").insert({
      insumo_id: selecionado.id,
      tipo: "saida_producao",
      quantidade: q,
      custo_unitario: Number(selecionado.custo_medio),
      custo_total: Number(selecionado.custo_medio) * q,
      observacoes: "Baixa via tablet",
    });
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${num(q)} ${selecionado.unidade} de ${selecionado.nome} baixados`);
    setQtd("");
    setSelecionado(null);
    setBusca("");
    qc.invalidateQueries({ queryKey: ["insumos-baixa"] });
    qc.invalidateQueries({ queryKey: ["ultimas-baixas"] });
    qc.invalidateQueries({ queryKey: ["alertas-estoque"] });
    qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

  return (
    <div>
      <PageHeader
        eyebrow="Tablet · cozinha & pizzaria"
        title="Baixa rápida"
        description="Toque no insumo, digite a quantidade e confirme. Cada lançamento gera saída de estoque imediata."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Coluna esquerda — busca e lista */}
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar insumo (ex: mussarela, farinha, refri...)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 h-12 text-base bg-card border-border"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtrados.length === 0 && (
              <div className="col-span-full rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum insumo encontrado para "{busca}"
              </div>
            )}
            {filtrados.map((i) => {
              const ativo = selecionado?.id === i.id;
              const baixo = i.estoque_atual <= i.ponto_reposicao;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setSelecionado(i)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all active:scale-[0.99]",
                    ativo
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-border/80 hover:bg-elevated",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {i.nome}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Estoque: <span className={cn("tabular-nums", baixo && "text-destructive font-medium")}>
                          {num(Number(i.estoque_atual))} {i.unidade}
                        </span>
                      </div>
                    </div>
                    {baixo && (
                      <span className="shrink-0 rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive">
                        baixo
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coluna direita — keypad */}
        <div className="space-y-4">
          <Card className="border-border bg-card p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Insumo selecionado
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Package2 className="h-4 w-4 text-primary shrink-0" />
              <div className="font-display text-lg text-foreground truncate">
                {selecionado?.nome ?? "—"}
              </div>
            </div>
            {selecionado && (
              <div className="mt-1 text-xs text-muted-foreground">
                Custo médio: {brl(Number(selecionado.custo_medio))} / {selecionado.unidade}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-border bg-elevated px-4 py-5 text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Quantidade {selecionado?.unidade ? `(${selecionado.unidade})` : ""}
              </div>
              <div className="mt-1 font-display text-4xl tabular-nums text-foreground min-h-[44px]">
                {qtd || "0"}
              </div>
              {selecionado && qtd && (
                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                  ≈ {brl(Number(qtd) * Number(selecionado.custo_medio))}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {teclas.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => tap(k)}
                  className="rounded-lg border border-border bg-card hover:bg-elevated active:scale-[0.97] py-4 text-xl font-medium text-foreground tabular-nums transition-all"
                >
                  {k === "back" ? <Delete className="mx-auto h-5 w-5" /> : k}
                </button>
              ))}
              <button
                type="button"
                onClick={() => tap("C")}
                className="rounded-lg border border-border bg-card hover:bg-destructive/10 hover:border-destructive/40 active:scale-[0.97] py-4 text-sm font-medium text-muted-foreground transition-all"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={!selecionado || !qtd || salvando}
                className="col-span-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow active:scale-[0.97] py-4 text-base font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Confirmar baixa
              </button>
            </div>

            {selecionado && (
              <button
                type="button"
                onClick={() => {
                  setSelecionado(null);
                  setQtd("");
                }}
                className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground py-1.5 flex items-center justify-center gap-1"
              >
                <X className="h-3 w-3" /> Desfazer seleção
              </button>
            )}
          </Card>

          <Card className="border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Últimas 8 baixas
              </div>
            </div>
            <div className="divide-y divide-border">
              {ultimasBaixas.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma baixa registrada ainda.
                </div>
              )}
              {ultimasBaixas.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">
                      {b.insumos?.nome}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(b.data_movimento).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div className="font-medium text-foreground">
                      −{num(Number(b.quantidade))} {b.insumos?.unidade}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {brl(Number(b.custo_total))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
