import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, ChefHat, Pizza, Cookie, Coffee, Salad, X } from "lucide-react";
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

type Categoria = Database["public"]["Enums"]["categoria_ficha"];
type Unidade = Database["public"]["Enums"]["unidade_medida"];
type Ficha = Database["public"]["Tables"]["fichas_tecnicas"]["Row"];
type Item = Database["public"]["Tables"]["ficha_itens"]["Row"] & {
  insumos?: { nome: string; unidade: Unidade } | null;
};

const CATS: { value: Categoria; label: string; icon: typeof Pizza }[] = [
  { value: "pizza", label: "Pizza", icon: Pizza },
  { value: "cozinha", label: "Cozinha", icon: ChefHat },
  { value: "sobremesa", label: "Sobremesa", icon: Cookie },
  { value: "salgado", label: "Salgado", icon: Salad },
  { value: "bebida", label: "Bebida", icon: Coffee },
];

const UNIDADES: Unidade[] = ["kg", "g", "l", "ml", "un", "pct", "cx", "dz"];

export const Route = createFileRoute("/_app/fichas")({
  head: () => ({ meta: [{ title: "Fichas Técnicas — LLum Pizzaria" }] }),
  component: FichasPage,
});

function FichasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Categoria | "all">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ficha | null>(null);

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ["fichas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fichas_tecnicas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtered = tab === "all" ? fichas : fichas.filter((f) => f.categoria === tab);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta ficha técnica e todos os seus itens?")) return;
    const { error } = await supabase.from("fichas_tecnicas").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Ficha removida");
      qc.invalidateQueries({ queryKey: ["fichas"] });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Receituário"
        title="Fichas Técnicas"
        description="A base do CMV. Cada receita lista insumos e gramaturas — o sistema calcula o custo automaticamente toda vez que algo muda."
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gradient-ember text-primary-foreground shadow-elegant">
                <Plus className="h-4 w-4" /> Nova ficha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing ? `Editar — ${editing.nome}` : "Nova ficha técnica"}
                </DialogTitle>
              </DialogHeader>
              <FichaForm
                ficha={editing}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["fichas"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <CatChip
          active={tab === "all"}
          onClick={() => setTab("all")}
          label={`Todas (${fichas.length})`}
        />
        {CATS.map(({ value, label, icon: Icon }) => {
          const count = fichas.filter((f) => f.categoria === value).length;
          return (
            <CatChip
              key={value}
              active={tab === value}
              onClick={() => setTab(value)}
              label={`${label} (${count})`}
              icon={Icon}
            />
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card/60">
          <ChefHat className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma ficha nesta categoria.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            const cat = CATS.find((c) => c.value === f.categoria);
            const Icon = cat?.icon ?? ChefHat;
            return (
              <Card
                key={f.id}
                className="group p-5 bg-gradient-surface border-border/60 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg leading-tight text-foreground">
                        {f.nome}
                      </h3>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {cat?.label}
                      </div>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(f);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md bg-card/40 p-2.5">
                    <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                      Rendimento
                    </div>
                    <div className="mt-0.5 font-display text-base text-foreground tabular-nums">
                      {num(Number(f.rendimento_porcoes), 0)} {f.unidade_rendimento}
                    </div>
                  </div>
                  <div className="rounded-md bg-card/40 p-2.5">
                    <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                      CMV / porção
                    </div>
                    <div className="mt-0.5 font-display text-base text-primary tabular-nums">
                      {brl(Number(f.cmv_por_porcao))}
                    </div>
                  </div>
                </div>
                {f.preco_venda && (
                  <div className="mt-3 flex items-center justify-between rounded-md bg-success/10 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Venda · margem</span>
                    <span className="font-medium text-success tabular-nums">
                      {brl(Number(f.preco_venda))} ·{" "}
                      {(
                        ((Number(f.preco_venda) - Number(f.cmv_por_porcao)) /
                          Number(f.preco_venda)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CatChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: typeof Pizza;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-gradient-ember text-primary-foreground shadow-elegant"
          : "bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground border border-border/60"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

interface ItemDraft {
  id?: string;
  insumo_id: string;
  quantidade: number;
  unidade: Unidade;
}

function FichaForm({ ficha, onSaved }: { ficha: Ficha | null; onSaved: () => void }) {
  const [nome, setNome] = useState(ficha?.nome ?? "");
  const [categoria, setCategoria] = useState<Categoria>(ficha?.categoria ?? "pizza");
  const [rendimento, setRendimento] = useState(String(ficha?.rendimento_porcoes ?? 1));
  const [unidadeRend, setUnidadeRend] = useState(ficha?.unidade_rendimento ?? "porção");
  const [preco, setPreco] = useState(String(ficha?.preco_venda ?? ""));
  const [tempo, setTempo] = useState(String(ficha?.tempo_preparo_min ?? ""));
  const [modo, setModo] = useState(ficha?.modo_preparo ?? "");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("insumos")
        .select("id, nome, unidade, custo_medio")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  // Load existing items when editing
  useQuery({
    queryKey: ["ficha-items", ficha?.id],
    queryFn: async () => {
      if (!ficha) return [];
      const { data } = await supabase
        .from("ficha_itens")
        .select("*")
        .eq("ficha_id", ficha.id);
      const list = (data ?? []).map((i) => ({
        id: i.id,
        insumo_id: i.insumo_id,
        quantidade: Number(i.quantidade),
        unidade: i.unidade,
      }));
      setItems(list);
      return list;
    },
    enabled: !!ficha,
  });

  const addItem = () => {
    if (insumos.length === 0) {
      toast.error("Cadastre insumos primeiro");
      return;
    }
    setItems([
      ...items,
      { insumo_id: insumos[0].id, quantidade: 1, unidade: insumos[0].unidade },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // CMV preview
  const cmvPreview = items.reduce((acc, it) => {
    const insumo = insumos.find((i) => i.id === it.insumo_id);
    if (!insumo) return acc;
    // simple direct multiplier (assumes same unit) — production would convert
    return acc + Number(insumo.custo_medio) * it.quantidade;
  }, 0);
  const cmvPorPorcao = Number(rendimento) > 0 ? cmvPreview / Number(rendimento) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome,
        categoria,
        rendimento_porcoes: Number(rendimento),
        unidade_rendimento: unidadeRend,
        preco_venda: preco ? Number(preco) : null,
        tempo_preparo_min: tempo ? Number(tempo) : null,
        modo_preparo: modo || null,
      };

      let fichaId: string;
      if (ficha) {
        const { error } = await supabase
          .from("fichas_tecnicas")
          .update(payload)
          .eq("id", ficha.id);
        if (error) throw error;
        fichaId = ficha.id;
        // Replace items: delete + insert
        await supabase.from("ficha_itens").delete().eq("ficha_id", fichaId);
      } else {
        const { data, error } = await supabase
          .from("fichas_tecnicas")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        fichaId = data.id;
      }

      if (items.length > 0) {
        const itemsPayload = items.map((it) => {
          const insumo = insumos.find((i) => i.id === it.insumo_id);
          const custo = (insumo?.custo_medio ?? 0) * it.quantidade;
          return {
            ficha_id: fichaId,
            insumo_id: it.insumo_id,
            quantidade: it.quantidade,
            unidade: it.unidade,
            custo_item: custo,
          };
        });
        const { error } = await supabase.from("ficha_itens").insert(itemsPayload);
        if (error) throw error;
      }

      toast.success(ficha ? "Ficha atualizada" : "Ficha criada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Rendimento</Label>
          <Input
            type="number"
            step="0.5"
            value={rendimento}
            onChange={(e) => setRendimento(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Unidade rend.</Label>
          <Input
            value={unidadeRend}
            onChange={(e) => setUnidadeRend(e.target.value)}
            placeholder="porção"
          />
        </div>
        <div className="space-y-2">
          <Label>Tempo (min)</Label>
          <Input
            type="number"
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preço de venda (R$, opcional)</Label>
        <Input
          type="number"
          step="0.01"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          placeholder="Para análise de margem"
        />
      </div>

      {/* Items */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Insumos da receita</Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              Nenhum insumo adicionado. O CMV será zero.
            </div>
          )}
          {items.map((it, idx) => {
            const insumo = insumos.find((i) => i.id === it.insumo_id);
            const custo = (insumo?.custo_medio ?? 0) * it.quantidade;
            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-2"
              >
                <Select
                  value={it.insumo_id}
                  onValueChange={(v) => {
                    const ins = insumos.find((i) => i.id === v);
                    updateItem(idx, { insumo_id: v, unidade: ins?.unidade ?? it.unidade });
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insumos.map((ins) => (
                      <SelectItem key={ins.id} value={ins.id}>
                        {ins.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.001"
                  value={it.quantidade}
                  onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })}
                  className="w-24"
                />
                <Select
                  value={it.unidade}
                  onValueChange={(v) => updateItem(idx, { unidade: v as Unidade })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-20 text-right text-xs tabular-nums text-primary font-medium">
                  {brl(custo)}
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CMV preview */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            CMV total receita
          </div>
          <div className="mt-1 font-display text-2xl text-foreground tabular-nums">
            {brl(cmvPreview)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            CMV por porção
          </div>
          <div className="mt-1 font-display text-2xl text-primary tabular-nums">
            {brl(cmvPorPorcao)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Modo de preparo (opcional)</Label>
        <Textarea value={modo} onChange={(e) => setModo(e.target.value)} rows={3} />
      </div>

      <Button
        type="submit"
        disabled={saving}
        className="w-full bg-gradient-ember text-primary-foreground shadow-elegant"
      >
        {saving ? "Salvando..." : ficha ? "Atualizar ficha" : "Criar ficha"}
      </Button>
    </form>
  );
}
