import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";

interface ParamRow {
  ficha_id: string;
  nome: string;
  categoria: string;
  cmv_por_porcao: number;
  porcoes_por_pessoa: number;
  peso_dia_semana: number;
  ativo: boolean;
}

export const Route = createFileRoute("/_app/demanda")({
  head: () => ({ meta: [{ title: "Parâmetros de Demanda — LLum" }] }),
  component: DemandaPage,
});

function DemandaPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { porcoes: string; peso: string }>>({});

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
          ativo: p?.ativo ?? true,
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
    toast.success(`${row.nome} atualizado`);
    setEdits((prev) => {
      const { [row.ficha_id]: _, ...rest } = prev;
      return rest;
    });
    qc.invalidateQueries({ queryKey: ["params-demanda"] });
  }

  const grouped = rows.reduce<Record<string, ParamRow[]>>((acc, r) => {
    (acc[r.categoria] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow="Inteligência operacional"
        title="Parâmetros de demanda do buffet"
        description="Defina quantas porções cada pessoa consome em média por ficha. O motor usa esses parâmetros para gerar a ordem de produção do dia."
      />

      <Card className="mb-6 border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Como calibrar:</strong> divida a quantidade total
            consumida de cada item em um dia médio pelo número de pessoas que vieram. Ex: se 200
            pessoas consomem 50 lasanhas-porção → <code>0.25</code> porções/pessoa. O peso por dia
            ajusta sazonalidade (1.0 = normal, 1.2 = sábado, 0.8 = chuva).
          </div>
        </div>
      </Card>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}

      <div className="space-y-8">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              {cat}
            </h2>
            <Card className="overflow-hidden border-border/60">
              <div className="hidden grid-cols-[1fr_140px_140px_140px_120px] gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:grid">
                <div>Ficha técnica</div>
                <div className="text-right">CMV/porção</div>
                <div className="text-right">Porções / pessoa</div>
                <div className="text-right">Peso do dia</div>
                <div></div>
              </div>
              <div className="divide-y divide-border/50">
                {items.map((row) => {
                  const e = edits[row.ficha_id];
                  const dirty = e !== undefined && (e.porcoes !== "" || e.peso !== "");
                  return (
                    <div
                      key={row.ficha_id}
                      className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1fr_140px_140px_140px_120px] md:items-center"
                    >
                      <div className="text-sm font-medium text-foreground">{row.nome}</div>
                      <div className="text-right text-sm tabular-nums text-muted-foreground">
                        {brl(row.cmv_por_porcao)}
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.001"
                          inputMode="decimal"
                          value={e?.porcoes ?? ""}
                          placeholder={num(row.porcoes_por_pessoa, 4)}
                          onChange={(ev) => setEdit(row.ficha_id, "porcoes", ev.target.value)}
                          className="h-9 text-right tabular-nums"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.05"
                          value={e?.peso ?? ""}
                          placeholder={num(row.peso_dia_semana, 2)}
                          onChange={(ev) => setEdit(row.ficha_id, "peso", ev.target.value)}
                          className="h-9 text-right tabular-nums"
                        />
                      </div>
                      <div className="md:text-right">
                        <Button
                          size="sm"
                          variant={dirty ? "default" : "ghost"}
                          onClick={() => salvar(row)}
                          className={dirty ? "bg-gradient-ember text-primary-foreground" : ""}
                        >
                          <Save className="h-3.5 w-3.5 md:mr-1" />
                          <span className="hidden md:inline">Salvar</span>
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
          <Card className="p-12 text-center text-sm text-muted-foreground">
            Cadastre fichas técnicas em <strong className="text-foreground">/fichas</strong> primeiro.
          </Card>
        )}
      </div>
    </div>
  );
}
