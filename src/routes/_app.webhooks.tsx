import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Webhook, Copy, Check, Power, Trash2, Activity } from "lucide-react";
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
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks n8n — LLum" }] }),
  component: WebhooksPage,
});

function WebhooksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<{ token: string; nome: string } | null>(null);

  const { data: tokens = [] } = useQuery({
    queryKey: ["webhook-tokens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("webhook_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/n8n`
      : "/api/webhooks/n8n";

  async function toggleAtivo(id: string, ativo: boolean) {
    const { error } = await (supabase as any)
      .from("webhook_tokens")
      .update({ ativo: !ativo })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(ativo ? "Token desativado" : "Token ativado");
    qc.invalidateQueries({ queryKey: ["webhook-tokens"] });
  }

  async function deletar(id: string) {
    if (!confirm("Excluir este token? Esta ação é irreversível.")) return;
    const { error } = await (supabase as any).from("webhook_tokens").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Token excluído");
    qc.invalidateQueries({ queryKey: ["webhook-tokens"] });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Integração externa"
        title="Webhooks · n8n"
        description="Tokens de API para automações n8n criarem ordens de produção a partir do grupo interno (LLM listener)."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-ember text-primary-foreground">
                <Plus className="h-4 w-4" /> Gerar token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {generated ? "Token criado" : "Novo token de webhook"}
                </DialogTitle>
              </DialogHeader>
              {generated ? (
                <TokenReveal
                  token={generated.token}
                  nome={generated.nome}
                  onClose={() => {
                    setGenerated(null);
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["webhook-tokens"] });
                  }}
                />
              ) : (
                <NovoTokenForm onCreated={(t, nome) => setGenerated({ token: t, nome })} />
              )}
            </DialogContent>
          </Dialog>
        }
      />

      {/* Endpoint */}
      <Card className="mb-6 border-border/60 bg-gradient-surface p-6">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg text-foreground">Endpoint</h3>
        </div>
        <CopyField label="URL" value={webhookUrl} />
        <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
          <div>
            <strong className="text-foreground">Método:</strong> POST
          </div>
          <div>
            <strong className="text-foreground">Header:</strong>{" "}
            <code className="rounded bg-muted/40 px-1.5 py-0.5 text-foreground">
              X-Webhook-Token: SEU_TOKEN
            </code>
          </div>
          <div>
            <strong className="text-foreground">Body (JSON):</strong>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-foreground">
{`{
  "data": "2026-04-19",
  "pessoas_esperadas": 220,
  "ticket_medio": 89.90,
  "observacoes": "domingo - dia das mães"
}`}
          </pre>
        </div>
      </Card>

      {/* Lista */}
      <Card className="border-border/60 bg-gradient-surface">
        <div className="border-b border-border/60 px-6 py-4">
          <h3 className="font-display text-lg text-foreground">
            Tokens ativos · {tokens.length}
          </h3>
        </div>
        <div className="divide-y divide-border/50">
          {tokens.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhum token. Gere o primeiro para conectar o n8n.
            </div>
          )}
          {tokens.map((t: any) => (
            <div
              key={t.id}
              className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[1fr_180px_140px_120px] md:items-center"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{t.nome}</div>
                <code className="text-xs text-muted-foreground">{t.token_prefix}…</code>
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {t.total_chamadas} chamadas
                </div>
                {t.ultimo_uso && (
                  <div className="mt-0.5">
                    último: {new Date(t.ultimo_uso).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>
              <div>
                <span
                  className={`text-[10px] uppercase tracking-wider ${t.ativo ? "text-emerald-400" : "text-muted-foreground"}`}
                >
                  {t.ativo ? "ativo" : "desativado"}
                </span>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggleAtivo(t.id, t.ativo)}
                  title={t.ativo ? "Desativar" : "Ativar"}
                >
                  <Power className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deletar(t.id)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NovoTokenForm({ onCreated }: { onCreated: (token: string, nome: string) => void }) {
  const [nome, setNome] = useState("");
  const [diasExp, setDiasExp] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const { data, error } = await supabase.rpc("gerar_token_webhook", {
      _nome: nome.trim(),
      ...(diasExp
        ? {
            _expira_em: new Date(
              Date.now() + Number(diasExp) * 86400000,
            ).toISOString(),
          }
        : {}),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    const result = data as { token: string };
    onCreated(result.token, nome.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome / descrição *</Label>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: n8n produção - listener WhatsApp"
          required
        />
      </div>
      <div>
        <Label>Validade (dias, opcional)</Label>
        <Input
          type="number"
          value={diasExp}
          onChange={(e) => setDiasExp(e.target.value)}
          placeholder="deixe vazio para nunca expirar"
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 bg-gradient-ember text-primary-foreground"
        >
          {saving ? "Gerando..." : "Gerar token"}
        </Button>
      </div>
    </form>
  );
}

function TokenReveal({
  token,
  nome,
  onClose,
}: {
  token: string;
  nome: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
        ⚠️ <strong>Copie agora.</strong> Por segurança, este token só é exibido uma vez.
      </div>
      <div>
        <Label>{nome}</Label>
        <CopyField label="" value={token} />
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose}>Concluir</Button>
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className={label ? "mt-3" : ""}>
      {label && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <code className="flex-1 break-all rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground">
          {value}
        </code>
        <Button type="button" size="icon" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
