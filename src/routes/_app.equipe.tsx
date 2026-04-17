import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Users, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Vê e edita tudo, dashboards financeiros, IA completa" },
  { value: "gerente", label: "Gerente", desc: "Operacional + relatórios, sem precificação sensível" },
  { value: "cozinha", label: "Cozinha", desc: "Recebe a Ordem de Produção do Dia" },
  { value: "estoque", label: "Estoque/Compras", desc: "Alertas de reposição, entradas de notas" },
];

export const Route = createFileRoute("/_app/equipe")({
  head: () => ({ meta: [{ title: "Equipe — LLum Pizzaria" }] }),
  component: EquipePage,
});

function EquipePage() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  React.useEffect(() => {
    if (!loading && !hasRole("admin")) {
      toast.error("Apenas administradores podem gerenciar a equipe");
      navigate({ to: "/" });
    }
  }, [loading, hasRole, navigate]);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, AppRole[]>();
      (roles.data ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        rolesByUser.set(r.user_id, list);
      });
      return (profiles.data ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
    enabled: hasRole("admin"),
  });

  const toggleRole = async (userId: string, role: AppRole, currentlyHas: boolean) => {
    if (currentlyHas) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["team-members"] });
  };

  if (!hasRole("admin")) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Equipe & Acessos"
        description="Defina os perfis de cada usuário. Um usuário pode ter múltiplos perfis (ex: gerente + estoque)."
      />

      <Card className="mb-6 p-5 bg-primary/5 border-primary/30">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Como adicionar novos membros</p>
            <p className="mt-1 text-muted-foreground">
              Peça para a pessoa criar uma conta na tela de login. Depois disso ela aparece aqui e
              você define os perfis. O primeiro usuário do sistema é admin automaticamente.
            </p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <Card key={m.id} className="p-5 bg-card/60 border-border/60">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-ember text-primary-foreground font-display text-lg">
                    {m.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {ROLES.map((r) => {
                    const has = m.roles.includes(r.value);
                    return (
                      <label
                        key={r.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all ${
                          has
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <Checkbox
                          checked={has}
                          onCheckedChange={() => toggleRole(m.id, r.value, has)}
                        />
                        <span className="font-medium">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
          {members.length === 0 && (
            <Card className="p-12 text-center bg-card/60">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum membro ainda.</p>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r.value} className="p-4 bg-card/40 border-border/60">
            <div className="text-sm font-medium text-foreground capitalize">{r.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{r.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
