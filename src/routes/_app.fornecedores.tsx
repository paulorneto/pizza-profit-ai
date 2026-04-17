import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Fornecedor = Database["public"]["Tables"]["fornecedores"]["Row"];

export const Route = createFileRoute("/_app/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — LLum Pizzaria" }] }),
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir fornecedor?")) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Fornecedor removido");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Cadastros"
        title="Fornecedores"
        description="Quem entrega o quê. Vincule insumos aos fornecedores para análises de custo e simulações de troca."
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
                <Plus className="h-4 w-4" /> Novo fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
              </DialogHeader>
              <FornForm
                fornecedor={editing}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["fornecedores"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : fornecedores.length === 0 ? (
        <Card className="p-12 text-center bg-card/60">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum fornecedor cadastrado ainda.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {fornecedores.map((f) => (
            <Card key={f.id} className="p-5 bg-card/60 border-border/60">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg text-foreground">{f.nome}</h3>
                  {f.contato && (
                    <p className="mt-1 text-xs text-muted-foreground">{f.contato}</p>
                  )}
                  {f.telefone && (
                    <p className="mt-1 text-xs text-muted-foreground">📞 {f.telefone}</p>
                  )}
                </div>
                <div className="flex gap-1">
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
              {f.observacoes && (
                <p className="mt-3 text-xs text-muted-foreground">{f.observacoes}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FornForm({
  fornecedor,
  onSaved,
}: {
  fornecedor: Fornecedor | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(fornecedor?.nome ?? "");
  const [contato, setContato] = useState(fornecedor?.contato ?? "");
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? "");
  const [obs, setObs] = useState(fornecedor?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome,
      contato: contato || null,
      telefone: telefone || null,
      observacoes: obs || null,
    };
    const { error } = fornecedor
      ? await supabase.from("fornecedores").update(payload).eq("id", fornecedor.id)
      : await supabase.from("fornecedores").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(fornecedor ? "Atualizado" : "Criado");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Contato</Label>
        <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Nome do responsável" />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-ember text-primary-foreground shadow-elegant">
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
