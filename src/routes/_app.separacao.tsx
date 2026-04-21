// Tela /separacao — Lista consolidada de insumos a separar para a ordem do dia.
// Otimizada para tablet: ao lado de cada insumo, botão para baixar a quantidade prevista direto.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, Users, ListChecks, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/separacao")({
  head: () => ({ meta: [{ title: "Separação do dia — LLUM OS" }] }),
  component: SeparacaoPage,
});

type Necessidade = {
  insumo_id: string;
  nome: string;
  unidade: string;
  necessario: number;
  estoque: number;
  custo_unit: number;
  ja_baixado: number;
};

function SeparacaoPage() {
  const qc = useQueryClient();

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens-separacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("id, data_operacao, pessoas_esperadas, status, custo_previsto")
        .in("status", ["confirmada", "em_producao"])
        .order("data_operacao", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const [ordemId, setOrdemId] = useState<string | null>(null);
  const ordemAtiva = ordens.find((o) => o.id === ordemId) ?? ordens[0];
  const ativeId = ordemAtiva?.id;

  const { data: necessidades = [], isFetching } = useQuery({
    queryKey: ["necessidades", ativeId],
    enabled: !!ativeId,
    queryFn: async () => {
      // Buscar itens da ordem
      const { data: itens } = await supabase
        .from("ordem_itens")
        .select("id, ficha_id, porcoes_previstas, fichas_tecnicas(nome, rendimento_porcoes)")
        .eq("ordem_id", ativeId!);

      const necessidadeMap: Record<string, Necessidade> = {};

      for (const item of itens ?? []) {
        const ficha: any = (item as any).fichas_tecnicas;
        const rend = Number(ficha?.rendimento_porcoes) || 1;
        const porcoes = Number(item.porcoes_previstas);

        const { data: fichaItens } = await supabase
          .from("ficha_itens")
          .select("quantidade, insumos!inner(id, nome, unidade, estoque_atual, custo_medio)")
          .eq("ficha_id", item.ficha_id);

        for (const fi of fichaItens ?? []) {
          const ins: any = (fi as any).insumos;
          const consumo = (Number(fi.quantidade) / rend) * porcoes;
          const cur = necessidadeMap[ins.id] ?? {
            insumo_id: ins.id,
            nome: ins.nome,
            unidade: ins.unidade,
            necessario: 0,
            estoque: Number(ins.estoque_atual),
            custo_unit: Number(ins.custo_medio),
            ja_baixado: 0,
          };
          cur.necessario += consumo;
          necessidadeMap[ins.id] = cur;
        }
      }

      // Quanto já foi baixado pra essa ordem (movimentos com ordem_producao_id)
      const { data: movs } = await supabase
        .from("movimentos_estoque")
        .select("insumo_id, quantidade")
        .eq("ordem_producao_id", ativeId!)
        .eq("tipo", "saida_producao");
      for (const m of movs ?? []) {
        const cur = necessidadeMap[m.insumo_id];
        if (cur) cur.ja_baixado += Number(m.quantidade);
      }

      return Object.values(necessidadeMap)
        .map((n) => ({
          ...n,
          necessario: Number(n.necessario.toFixed(3)),
          ja_baixado: Number(n.ja_baixado.toFixed(3)),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const totals = useMemo(() => {
    const totalCusto = necessidades.reduce((a, n) => a + n.necessario * n.custo_unit, 0);
    const faltam = necessidades.filter((n) => n.necessario > n.estoque).length;
    const completos = necessidades.filter((n) => n.ja_baixado >= n.necessario).length;
    return { totalCusto, faltam, completos };
  }, [necessidades]);

  async function baixar(n: Necessidade, quantidade: number) {
    if (!ativeId) return;
    const { error } = await supabase.from("movimentos_estoque").insert({
      insumo_id: n.insumo_id,
      tipo: "saida_producao",
      quantidade,
      custo_unitario: n.custo_unit,
      custo_total: n.custo_unit * quantidade,
      ordem_producao_id: ativeId,
      observacoes: "Separação para ordem",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${num(quantidade)} ${n.unidade} de ${n.nome} baixados`);
    qc.invalidateQueries({ queryKey: ["necessidades", ativeId] });
    qc.invalidateQueries({ queryKey: ["alertas-estoque"] });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pré-serviço"
        title="Separação do dia"
        description="Lista consolidada de insumos para a ordem do dia. Toque para baixar do estoque assim que a equipe retirar."
        actions={
          <div className="w-full md:w-72">
            <Select value={ordemAtiva?.id ?? ""} onValueChange={setOrdemId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a ordem" />
              </SelectTrigger>
              <SelectContent>
                {ordens.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {new Date(o.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
                    {o.pessoas_esperadas} pessoas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {!ordemAtiva && (
        <Card className="p-12 text-center border-border bg-card">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma ordem confirmada. Gere uma em <strong className="text-foreground">/producao</strong>.
          </p>
        </Card>
      )}

      {ordemAtiva && (
        <>
          <div className="grid gap-3 md:grid-cols-4 mb-6">
            <Mini icon={Calendar} label="Data" value={new Date(ordemAtiva.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")} />
            <Mini icon={Users} label="Pessoas previstas" value={String(ordemAtiva.pessoas_esperadas)} />
            <Mini icon={ListChecks} label="Insumos a separar" value={String(necessidades.length)} accent={totals.faltam > 0 ? "warning" : "default"} />
            <Mini icon={CheckCircle2} label="Já separados" value={`${totals.completos}/${necessidades.length}`} accent="success" />
          </div>

          <Card className="border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base text-foreground">Lista de separação</h3>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                Custo previsto: <span className="text-foreground font-medium">{brl(totals.totalCusto)}</span>
              </div>
            </div>

            {isFetching && necessidades.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                <div className="mt-2">Calculando insumos...</div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {necessidades.length === 0 && (
                  <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Nenhum insumo previsto. Configure parâmetros de demanda e cardápio.
                  </div>
                )}
                {necessidades.map((n) => {
                  const restante = Math.max(0, n.necessario - n.ja_baixado);
                  const completo = n.ja_baixado >= n.necessario && n.necessario > 0;
                  const semEstoque = n.estoque < restante;
                  return (
                    <div
                      key={n.insumo_id}
                      className={cn(
                        "grid grid-cols-1 md:grid-cols-[1fr_120px_140px_180px] gap-3 px-5 py-3 items-center",
                        completo && "bg-success/5",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {completo && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                          <div className="text-sm font-medium text-foreground truncate">{n.nome}</div>
                          {semEstoque && (
                            <span className="rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive">
                              <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5" />
                              estoque insuficiente
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                          Estoque: {num(n.estoque)} {n.unidade}
                          {" · "}
                          {brl(n.custo_unit)}/{n.unidade}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Necessário
                        </div>
                        <div className="font-display text-lg text-foreground tabular-nums">
                          {num(n.necessario)}
                          <span className="text-xs text-muted-foreground ml-1">{n.unidade}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Já baixado
                        </div>
                        <div className="text-sm tabular-nums text-foreground">
                          {num(n.ja_baixado)} {n.unidade}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {completo ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completo
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => baixar(n, restante)}
                            className="bg-primary text-primary-foreground hover:bg-primary-glow gap-1.5 h-9"
                          >
                            Baixar {num(restante)} {n.unidade}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
  accent = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "default" | "success" | "warning";
}) {
  const map = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", map[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-base text-foreground tabular-nums truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
