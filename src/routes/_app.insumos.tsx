import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
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

type UnidadeMedida = Database["public"]["Enums"]["unidade_medida"];
type Insumo = Database["public"]["Tables"]["insumos"]["Row"] & {
  fornecedores?: { nome: string } | null;
};

const UNIDADES: UnidadeMedida[] = ["kg", "g", "l", "ml", "un", "pct", "cx", "dz"];

export const Route = createFileRoute("/_app/insumos")({
  head: () => ({ meta: [{ title: "Insumos — LLum Pizzaria" }] }),
  component: InsumosPage,
});

function InsumosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);

  const { data: insumos = [], isLoading } = useQuery({
    queryKey: ["insumos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("*, fornecedores(nome)")
        .order("nome");
      if (error) throw error;
      return data as Insumo[];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const filtered = insumos.filter(
    (i) =>
      i.nome.toLowerCase().includes(search.toLowerCase()) ||
      (i.categoria ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este insumo?")) return;
    const { error } = await supabase.from("insumos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Insumo removido");
      qc.invalidateQueries({ queryKey: ["insumos"] });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Cadastros"
        title="Insumos"
        description="Matéria-prima da operação. O custo médio aqui alimenta automaticamente o CMV das fichas técnicas."
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
                <Plus className="h-4 w-4" /> Novo insumo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar insumo" : "Novo insumo"}</DialogTitle>
              </DialogHeader>
              <InsumoForm
                insumo={editing}
                fornecedores={fornecedores}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["insumos"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou categoria..."
          className="pl-9"
        />
      </div>

      <Card className="bg-card/60 border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-right">Estoque</th>
                <th className="px-4 py-3 text-right">Custo / un</th>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum insumo cadastrado ainda. Clique em "Novo insumo" para começar.
                  </td>
                </tr>
              )}
              {filtered.map((i) => {
                const baixo = Number(i.estoque_atual) <= Number(i.ponto_reposicao);
                return (
                  <tr key={i.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{i.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={baixo ? "text-destructive font-medium" : ""}>
                        {num(Number(i.estoque_atual))} {i.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {brl(Number(i.custo_medio))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {i.fornecedores?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(i);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(i.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function InsumoForm({
  insumo,
  fornecedores,
  onSaved,
}: {
  insumo: Insumo | null;
  fornecedores: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(insumo?.nome ?? "");
  const [unidade, setUnidade] = useState<UnidadeMedida>(insumo?.unidade ?? "kg");
  const [custo, setCusto] = useState(String(insumo?.custo_medio ?? 0));
  const [estoque, setEstoque] = useState(String(insumo?.estoque_atual ?? 0));
  const [ponto, setPonto] = useState(String(insumo?.ponto_reposicao ?? 0));
  const [categoria, setCategoria] = useState(insumo?.categoria ?? "");
  const [fornecedorId, setFornecedorId] = useState(insumo?.fornecedor_id ?? "");
  const [observacoes, setObservacoes] = useState(insumo?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome,
      unidade,
      custo_medio: Number(custo),
      estoque_atual: Number(estoque),
      ponto_reposicao: Number(ponto),
      categoria: categoria || null,
      fornecedor_id: fornecedorId || null,
      observacoes: observacoes || null,
    };
    const { error } = insumo
      ? await supabase.from("insumos").update(payload).eq("id", insumo.id)
      : await supabase.from("insumos").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(insumo ? "Insumo atualizado" : "Insumo criado");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Unidade *</Label>
          <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeMedida)}>
            <SelectTrigger>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <Input
            id="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Laticínios"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="custo">Custo médio (R$)</Label>
          <Input
            id="custo"
            type="number"
            step="0.0001"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estoque">Estoque atual</Label>
          <Input
            id="estoque"
            type="number"
            step="0.001"
            value={estoque}
            onChange={(e) => setEstoque(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ponto">Ponto reposição</Label>
          <Input
            id="ponto"
            type="number"
            step="0.001"
            value={ponto}
            onChange={(e) => setPonto(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Fornecedor</Label>
        <Select value={fornecedorId || "none"} onValueChange={(v) => setFornecedorId(v === "none" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Nenhum —</SelectItem>
            {fornecedores.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="obs">Observações</Label>
        <Textarea
          id="obs"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
        />
      </div>
      <Button
        type="submit"
        disabled={saving}
        className="w-full bg-gradient-ember text-primary-foreground shadow-elegant"
      >
        {saving ? "Salvando..." : insumo ? "Atualizar" : "Criar insumo"}
      </Button>
    </form>
  );
}
