import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowDown, ArrowUp, AlertTriangle, Package2, Boxes } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TipoMov = Database["public"]["Enums"]["tipo_movimento"];

const TIPO_LABEL: Record<TipoMov, string> = {
  entrada_compra: "Entrada (compra)",
  saida_producao: "Saída (produção)",
  ajuste_inventario: "Ajuste inventário",
  perda: "Perda",
  transferencia: "Transferência",
};

export const Route = createFileRoute("/_app/estoque")({
  head: () => ({ meta: [{ title: "Estoque — LLum Pizzaria" }] }),
  component: EstoquePage,
});

function EstoquePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_alertas_estoque")
        .select("*")
        .order("nivel", { ascending: true })
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ["movimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentos_estoque")
        .select("*, insumos(nome, unidade), fornecedores(nome)")
        .order("data_movimento", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nome, unidade, custo_medio, estoque_atual")
        .eq("ativo", true)
        .order("nome");
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

  const rupturas = alertas.filter((a) => a.nivel === "ruptura").length;
  const reposicao = alertas.filter((a) => a.nivel === "reposicao").length;
  const valorTotal = alertas.reduce(
    (acc, a) => acc + Number(a.estoque_atual ?? 0) * Number(a.custo_medio ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Estoque inteligente"
        description="Movimentações em tempo real, custo médio ponderado e alertas de ruptura."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-ember text-primary-foreground">
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
                onDone={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["movimentos"] });
                  qc.invalidateQueries({ queryKey: ["alertas-estoque"] });
                  qc.invalidateQueries({ queryKey: ["insumos-min"] });
                  qc.invalidateQueries({ queryKey: ["insumos"] });
                  qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={Boxes} label="Itens monitorados" value={String(alertas.length)} accent="primary" />
        <Kpi icon={Package2} label="Valor em estoque" value={brl(valorTotal)} accent="accent" />
        <Kpi
          icon={AlertTriangle}
          label="Ponto de reposição"
          value={String(reposicao)}
          accent={reposicao > 0 ? "warning" : "muted"}
        />
        <Kpi
          icon={AlertTriangle}
          label="Ruptura"
          value={String(rupturas)}
          accent={rupturas > 0 ? "destructive" : "muted"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 bg-gradient-surface">
          <div className="border-b border-border/60 px-6 py-4">
            <h3 className="font-display text-lg text-foreground">Últimas movimentações</h3>
          </div>
          <div className="divide-y divide-border/50">
            {movimentos.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada ainda.
              </div>
            )}
            {movimentos.map((m) => {
              const isEntrada = m.tipo === "entrada_compra";
              return (
                <div key={m.id} className="flex items-center gap-4 px-6 py-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      isEntrada ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {isEntrada ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {m.insumos?.nome ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {TIPO_LABEL[m.tipo as TipoMov]}
                      {m.fornecedores?.nome ? ` · ${m.fornecedores.nome}` : ""}
                      {m.documento ? ` · NF ${m.documento}` : ""}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-sm font-medium text-foreground">
                      {isEntrada ? "+" : "−"}
                      {num(Number(m.quantidade))} {m.insumos?.unidade}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Number(m.custo_total) > 0 ? brl(Number(m.custo_total)) : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-border/60 bg-gradient-surface">
          <div className="border-b border-border/60 px-6 py-4">
            <h3 className="font-display text-lg text-foreground">Alertas de reposição</h3>
          </div>
          <div className="divide-y divide-border/50">
            {alertas.filter((a) => a.nivel !== "ok").length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                Tudo certo. Nenhum item em alerta. ✨
              </div>
            )}
            {alertas
              .filter((a) => a.nivel !== "ok")
              .slice(0, 12)
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{a.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.fornecedor_nome ?? "Sem fornecedor"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        a.nivel === "ruptura"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {a.nivel}
                    </span>
                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {num(Number(a.estoque_atual))} / mín {num(Number(a.ponto_reposicao))} {a.unidade}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MovimentoForm({
  insumos,
  fornecedores,
  onDone,
}: {
  insumos: Array<{ id: string; nome: string; unidade: string; custo_medio: number }>;
  fornecedores: Array<{ id: string; nome: string }>;
  onDone: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMov>("entrada_compra");
  const [insumoId, setInsumoId] = useState("");
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABEL) as TipoMov[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Insumo *</Label>
          <Select value={insumoId} onValueChange={setInsumoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar insumo" />
            </SelectTrigger>
            <SelectContent>
              {insumos.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nome} ({i.unidade})
                </SelectItem>
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
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
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
        <Textarea
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving} className="bg-gradient-ember text-primary-foreground">
          {saving ? "Registrando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "primary" | "accent" | "warning" | "destructive" | "muted";
}) {
  const map = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5 bg-gradient-surface border-border/60 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-3xl text-foreground tabular-nums">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${map[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
