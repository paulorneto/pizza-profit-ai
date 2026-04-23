import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles, Save, Plus, Search, CheckCircle2, AlertCircle, Gauge, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParamRow {
  ficha_id: string;
  nome: string;
  categoria: string;
  cmv_por_porcao: number;
  porcoes_por_pessoa: number;
  peso_dia_semana: number;
  tem_parametro: boolean;
}

export const Route = createFileRoute("/_app/demanda")({
  head: () => ({ meta: [{ title: "Parâmetros de Demanda — LLUM OS" }] }),
  component: DemandaPage,
});

function DemandaPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { porcoes: string; peso: string }>>({});
  const [busca, setBusca] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["params-demanda"],
    queryFn: async () => {
      const { data: fichas, error: e1 } = await supabase
        .from("fichas_tecnicas")
        .select("id, nome, categoria, cmv_por_porcao")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (e1) throw e1;

      const { data: params, error: e2 } = await supabase
        .from("parametros_demanda")
        .select("*");
      if (e2) throw e2;

      const map = new Map(params.map((p) => [p.ficha_id, p]));
      return (fichas ?? []).map<ParamRow>((f) => {
        const p = map.get(f.id);
        return {
          ficha_id: f.id,
          nome: f.nome,
          categoria: f.categoria,
          cmv_por_porcao: Number(f.cmv_por_porcao),
          porcoes_por_pessoa: Number(p?.porcoes_por_pessoa ?? 0),
          peso_dia_semana: Number(p?.peso_dia_semana ?? 1),
          tem_parametro: !!p && Number(p.porcoes_por_pessoa) > 0,
        };
      });
    },
  });

  function setEdit(id: string, field: "porcoes" | "peso", value: string) {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        porcoes: prev[id]?.porcoes ?? "",
        peso: prev[id]?.peso ?? "",
        [field]: value,
      },
    }));
  }

  async function salvar(row: ParamRow) {
    const e = edits[row.ficha_id];
    const porcoes = e?.porcoes !== undefined && e.porcoes !== ""
      ? Number(e.porcoes)
      : row.porcoes_por_pessoa;
    const peso = e?.peso !== undefined && e.peso !== ""
      ? Number(e.peso)
      : row.peso_dia_semana;

    if (Number.isNaN(porcoes) || porcoes < 0) {
      toast.error("Porções por pessoa inválido");
      return;
    }
    const { error } = await supabase
      .from("parametros_demanda")
      .upsert(
        {
          ficha_id: row.ficha_id,
          porcoes_por_pessoa: porcoes,
          peso_dia_semana: peso,
          ativo: true,
        },
        { onConflict: "ficha_id" },
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${row.nome} ${row.tem_parametro ? "atualizado" : "adicionado"}`);
    setEdits((prev) => {
      const { [row.ficha_id]: _, ...rest } = prev;
      return rest;
    });
    qc.invalidateQueries({ queryKey: ["params-demanda"] });
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const cobertos = rows.filter((r) => r.tem_parametro).length;
    const pendentes = total - cobertos;
    const consumoPP = rows
      .filter((r) => r.tem_parametro)
      .reduce((a, r) => a + r.cmv_por_porcao * r.porcoes_por_pessoa * r.peso_dia_semana, 0);
    return { total, cobertos, pendentes, consumoPP };
  }, [rows]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.categoria.toLowerCase().includes(q),
    );
  }, [rows, busca]);

  const grouped = filtrados.reduce<Record<string, ParamRow[]>>((acc, r) => {
    (acc[r.categoria] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow="Inteligência operacional"
        title="Parâmetros de demanda do buffet"
        description="Defina quantas porções cada pessoa consome em média por ficha. O motor cruza esses parâmetros com o cardápio do dia para gerar a ordem de produção e o custo previsto."
        actions={
          <Link to="/fichas">
            <Button variant="outline" className="gap-2 border-border bg-card hover:bg-elevated">
              <Plus className="h-4 w-4" /> Adicionar nova ficha
            </Button>
          </Link>
        }
      />

      {/* KPIs de cobertura */}
      <div className="grid gap-3 md:grid-cols-4 mb-6">
        <Kpi
          icon={Gauge}
          label="Fichas cobertas"
          value={`${stats.cobertos} / ${stats.total}`}
          hint={
            stats.pendentes > 0
              ? `${stats.pendentes} sem parâmetro`
              : "Todas calibradas"
          }
          accent={stats.pendentes > 0 ? "warning" : "success"}
        />
        <Kpi
          icon={Users}
          label="Consumo previsto / pessoa"
          value={brl(stats.consumoPP)}
          hint="Soma CMV × porções × peso"
          accent="primary"
        />
        <Kpi
          icon={CheckCircle2}
          label="Calibradas"
          value={String(stats.cobertos)}
          hint="Com porções/pessoa > 0"
          accent="muted"
        />
        <Kpi
          icon={AlertCircle}
          label="Pendentes"
          value={String(stats.pendentes)}
          hint={stats.pendentes > 0 ? "Configurar abaixo" : "Sem pendências"}
          accent={stats.pendentes > 0 ? "destructive" : "muted"}
        />
      </div>

      {/* Painel de ajuda */}
      <Card className="mb-6 border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <div>
              <strong className="text-foreground">Como adicionar / calibrar:</strong>{" "}
              digite no campo <strong>Porções/pessoa</strong> e clique em Salvar — o sistema cria o parâmetro
              automaticamente se ainda não existir.
            </div>
            <div className="text-xs">
              <strong className="text-foreground">Exemplo:</strong> se 200 pessoas consomem 50 lasanhas-porção em
              um dia médio → <code className="rounded bg-elevated px-1 py-0.5">0,25 porções/pessoa</code>. O
              <strong className="text-foreground"> peso do dia</strong> ajusta sazonalidade (1.0 = normal, 1.2 =
              sábado lotado, 0.8 = chuva). Para incluir uma ficha que ainda não existe, use o botão{" "}
              <strong className="text-foreground">Adicionar nova ficha</strong> no topo.
            </div>
          </div>
        </div>
      </Card>

      {/* Busca */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar ficha ou categoria..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 h-9 bg-card border-border"
        />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              {cat} · {items.length}
            </h2>
            <Card className="overflow-hidden border-border bg-card">
              <div className="hidden grid-cols-[1fr_120px_140px_140px_120px] gap-3 border-b border-border bg-elevated/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                <div>Ficha técnica</div>
                <div className="text-right">CMV/porção</div>
                <div className="text-right">Porções / pessoa</div>
                <div className="text-right">Peso do dia</div>
                <div className="text-right">Status</div>
              </div>
              <div className="divide-y divide-border">
                {items.map((row) => {
                  const e = edits[row.ficha_id];
                  const dirty = e !== undefined && (e.porcoes !== "" || e.peso !== "");
                  return (
                    <div
                      key={row.ficha_id}
                      className={cn(
                        "grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1fr_120px_140px_140px_120px] md:items-center",
                        !row.tem_parametro && "bg-warning/5",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {row.tem_parametro ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
                        )}
                        <div className="text-sm font-medium text-foreground">{row.nome}</div>
                      </div>
                      <div className="text-right text-sm tabular-nums text-muted-foreground">
                        {brl(row.cmv_por_porcao)}
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.001"
                          inputMode="decimal"
                          value={e?.porcoes ?? ""}
                          placeholder={row.tem_parametro ? num(row.porcoes_por_pessoa, 4) : "0,000"}
                          onChange={(ev) => setEdit(row.ficha_id, "porcoes", ev.target.value)}
                          className={cn(
                            "h-9 text-right tabular-nums bg-elevated border-border",
                            !row.tem_parametro && "border-warning/40",
                          )}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.05"
                          value={e?.peso ?? ""}
                          placeholder={num(row.peso_dia_semana, 2)}
                          onChange={(ev) => setEdit(row.ficha_id, "peso", ev.target.value)}
                          className="h-9 text-right tabular-nums bg-elevated border-border"
                        />
                      </div>
                      <div className="md:text-right">
                        <Button
                          size="sm"
                          variant={dirty ? "default" : "ghost"}
                          onClick={() => salvar(row)}
                          className={cn(
                            "h-8 gap-1",
                            dirty
                              ? "bg-primary text-primary-foreground hover:bg-primary-glow"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          disabled={!dirty}
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">
                            {row.tem_parametro ? "Salvar" : "Adicionar"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}
        {rows.length === 0 && !isLoading && (
          <Card className="p-12 text-center border-border bg-card">
            <div className="text-sm text-muted-foreground">
              Nenhuma ficha cadastrada ainda.
            </div>
            <Link to="/fichas">
              <Button className="mt-4 gap-2 bg-primary text-primary-foreground hover:bg-primary-glow">
                <Plus className="h-4 w-4" /> Cadastrar primeira ficha
              </Button>
            </Link>
          </Card>
        )}
        {rows.length > 0 && filtrados.length === 0 && (
          <Card className="p-8 text-center border-border bg-card text-sm text-muted-foreground">
            Nenhuma ficha encontrada para "{busca}"
          </Card>
        )}
      </div>
    </div>
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
  accent: "primary" | "warning" | "success" | "destructive" | "muted";
}) {
  const map = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div className="mt-1 font-display text-xl text-foreground tabular-nums truncate">
            {value}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</div>
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md shrink-0", map[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
