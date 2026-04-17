import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, UtensilsCrossed, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/PageHeader";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio do Buffet — LLum Pizzaria" }] }),
  component: CardapioPage,
});

function CardapioPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: cardapio = [], isLoading } = useQuery({
    queryKey: ["cardapio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cardapio")
        .select("*, fichas_tecnicas(id, nome, categoria, cmv_por_porcao, preco_venda)")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const ativos = cardapio.filter((c) => c.ativo);

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("cardapio").update({ ativo }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["cardapio"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("cardapio").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido do cardápio");
      qc.invalidateQueries({ queryKey: ["cardapio"] });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operação diária"
        title="Cardápio do Buffet"
        description="Os pratos que vão pra rampa hoje. Esta lista alimenta o motor de produção e a previsão de consumo."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-ember text-primary-foreground shadow-elegant">
                <Plus className="h-4 w-4" /> Adicionar prato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar ao cardápio</DialogTitle>
              </DialogHeader>
              <AddCardapio
                onSaved={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["cardapio"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-4 bg-gradient-surface border-border/60">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Pratos no cardápio
          </div>
          <div className="mt-2 font-display text-3xl text-foreground tabular-nums">
            {ativos.length}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-surface border-border/60">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            CMV médio (ativos)
          </div>
          <div className="mt-2 font-display text-3xl text-primary tabular-nums">
            {brl(
              ativos.length > 0
                ? ativos.reduce(
                    (a, c) => a + Number(c.fichas_tecnicas?.cmv_por_porcao ?? 0),
                    0,
                  ) / ativos.length
                : 0,
            )}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-surface border-border/60">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Categorias cobertas
          </div>
          <div className="mt-2 font-display text-3xl text-foreground tabular-nums">
            {new Set(ativos.map((c) => c.fichas_tecnicas?.categoria)).size}
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : cardapio.length === 0 ? (
        <Card className="p-12 text-center bg-card/60">
          <UtensilsCrossed className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Cardápio vazio. Adicione pratos das fichas técnicas para montar o buffet.
          </p>
        </Card>
      ) : (
        <Card className="bg-card/60 border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left w-8"></th>
                  <th className="px-4 py-3 text-left">Prato</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-right">CMV / porção</th>
                  <th className="px-4 py-3 text-center">Ativo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cardapio.map((c) => (
                  <tr key={c.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {c.fichas_tecnicas?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {c.fichas_tecnicas?.categoria ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-primary">
                      {brl(Number(c.fichas_tecnicas?.cmv_por_porcao ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={(v) => toggleAtivo(c.id, v)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function AddCardapio({ onSaved }: { onSaved: () => void }) {
  const [fichaId, setFichaId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: fichas = [] } = useQuery({
    queryKey: ["fichas-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fichas_tecnicas")
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fichaId) return;
    setSaving(true);
    const { error } = await supabase.from("cardapio").insert({ ficha_id: fichaId });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Adicionado ao cardápio");
      onSaved();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label>Selecione o prato (ficha técnica)</Label>
        <Select value={fichaId} onValueChange={setFichaId}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha..." />
          </SelectTrigger>
          <SelectContent>
            {fichas.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome} · {f.categoria}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        disabled={!fichaId || saving}
        className="w-full bg-gradient-ember text-primary-foreground shadow-elegant"
      >
        {saving ? "Adicionando..." : "Adicionar"}
      </Button>
    </form>
  );
}
