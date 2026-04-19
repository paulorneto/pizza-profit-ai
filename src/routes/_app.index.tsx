import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pizza,
  AlertTriangle,
  Sparkles,
  Users,
  ArrowRight,
  Bot,
  Loader2,
  Info,
  AlertOctagon,
  DollarSign,
  ShoppingCart,
  PiggyBank,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { brl, num } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [{ title: "Painel — LLum Pizzaria" }],
  }),
  component: DashboardPage,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const [insumos, fichas, cardapio] = await Promise.all([
        supabase.from("insumos").select("id, nome, estoque_atual, ponto_reposicao, custo_medio, unidade"),
        supabase.from("fichas_tecnicas").select("id, nome, categoria, cmv_por_porcao, ativo"),
        supabase.from("cardapio").select("id, ativo").eq("ativo", true),
      ]);
      const insumosData = insumos.data ?? [];
      const fichasData = fichas.data ?? [];
      const valorEstoque = insumosData.reduce(
        (acc, i) => acc + Number(i.estoque_atual) * Number(i.custo_medio),
        0,
      );
      const rupturas = insumosData.filter(
        (i) => Number(i.estoque_atual) <= Number(i.ponto_reposicao),
      );
      const cmvMedio =
        fichasData.length > 0
          ? fichasData.reduce((a, f) => a + Number(f.cmv_por_porcao), 0) / fichasData.length
          : 0;
      return {
        totalInsumos: insumosData.length,
        valorEstoque,
        rupturas,
        totalFichas: fichasData.length,
        fichasAtivas: fichasData.filter((f) => f.ativo).length,
        cmvMedio,
        cardapioAtivo: cardapio.data?.length ?? 0,
      };
    },
  });
}

type Insight = { severidade: "info" | "warn" | "critical"; titulo: string; descricao: string; acao: string };

function useInsights(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard-insights"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("consultor-insights", {
        body: {},
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.insights ?? []) as Insight[];
    },
  });
}

function DashboardPage() {
  const { user, roles } = useAuth();
  const { data, isLoading } = useDashboardData();
  const isAdminOrGerente = roles.includes("admin") || roles.includes("gerente");

  return (
    <div>
      <PageHeader
        eyebrow="Painel principal"
        title={`Olá${user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋`}
        description="Visão geral da operação. Conforme você cadastrar fichas, insumos e cardápio, este painel ganha vida com KPIs em tempo real."
      />

      {/* KPIs principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Package}
          label="Insumos cadastrados"
          value={isLoading ? "—" : String(data?.totalInsumos ?? 0)}
          hint={isLoading ? "" : `${brl(data?.valorEstoque ?? 0)} em estoque`}
          accent="primary"
        />
        <KpiCard
          icon={ChefHat}
          label="Fichas técnicas"
          value={isLoading ? "—" : String(data?.totalFichas ?? 0)}
          hint={isLoading ? "" : `${data?.fichasAtivas ?? 0} ativas`}
          accent="accent"
        />
        <KpiCard
          icon={TrendingUp}
          label="CMV médio por porção"
          value={isLoading ? "—" : brl(data?.cmvMedio ?? 0)}
          hint="Calculado das fichas"
          accent="success"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Rupturas / atenção"
          value={isLoading ? "—" : String(data?.rupturas.length ?? 0)}
          hint={
            isLoading
              ? ""
              : data && data.rupturas.length > 0
                ? "Itens abaixo do ponto"
                : "Tudo certo"
          }
          accent={data && data.rupturas.length > 0 ? "destructive" : "muted"}
        />
      </div>

      {/* Insights IA proativos */}
      {isAdminOrGerente && <InsightsSection />}

      {/* Próximos passos */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-6 bg-gradient-surface border-border/60">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-xl text-foreground">Roadmap LLum</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sistema 360 <strong className="text-foreground">completo</strong> — todas as 4 fases ativas.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <RoadmapItem done label="Auth multi-perfil + RLS" />
                <RoadmapItem done label="Cadastro de insumos, fichas, cardápio" />
                <RoadmapItem done label="CMV calculado automaticamente" />
                <RoadmapItem done label="Estoque inteligente + custo médio ponderado" />
                <RoadmapItem done label="Motor de demanda → ordem de produção" />
                <RoadmapItem done label="Webhook n8n autenticado + fechamento do dia" />
                <RoadmapItem done label="Consultor IA 360 + simulações de cenário" />
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-surface border-border/60">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15">
              <Pizza className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-xl text-foreground">Comece agora</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Para o motor de IA funcionar, ele precisa de fichas técnicas e custos de insumos
                como base.
              </p>
              <div className="mt-4 grid gap-2">
                <ActionLink to="/insumos" label="1. Cadastre insumos" />
                <ActionLink to="/fichas" label="2. Monte fichas técnicas" />
                <ActionLink to="/cardapio" label="3. Defina cardápio do buffet" />
                <ActionLink to="/consultor" label="4. Converse com o Consultor IA" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Rupturas detalhadas */}
      {data && data.rupturas.length > 0 && (
        <Card className="mt-8 border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-display text-lg text-foreground">
              {data.rupturas.length} insumo{data.rupturas.length > 1 ? "s" : ""} no ponto de
              reposição
            </h3>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.rupturas.slice(0, 6).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md bg-card/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">{r.nome}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {num(Number(r.estoque_atual))} {r.unidade} (mín {num(Number(r.ponto_reposicao))})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        Seu perfil: {roles.join(", ") || "carregando..."}
      </div>
    </div>
  );
}

function InsightsSection() {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useInsights(enabled);

  return (
    <Card className="mt-8 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ember shadow-elegant">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg text-foreground">Insights do Consultor IA</h3>
            <p className="text-xs text-muted-foreground">
              Análise proativa cruzando estoque, fechamentos e ordens recentes.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!enabled) setEnabled(true);
            else refetch();
          }}
          disabled={isFetching}
          className="gap-2"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {enabled ? "Atualizar" : "Gerar insights"}
        </Button>
      </div>

      {!enabled && (
        <p className="mt-4 text-sm text-muted-foreground">
          Clique em <strong className="text-foreground">Gerar insights</strong> para o consultor
          analisar sua operação agora.
        </p>
      )}

      {enabled && isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Analisando...
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-destructive">{(error as Error).message}</div>
      )}

      {data && data.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.map((i, idx) => (
            <InsightCard key={idx} insight={i} />
          ))}
        </div>
      )}
      {data && data.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Tudo tranquilo — sem alertas no momento.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          to="/consultor"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Abrir chat completo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const map = {
    info: { Icon: Info, color: "border-primary/30 bg-primary/5", text: "text-primary" },
    warn: { Icon: AlertTriangle, color: "border-amber-500/30 bg-amber-500/5", text: "text-amber-400" },
    critical: { Icon: AlertOctagon, color: "border-destructive/40 bg-destructive/5", text: "text-destructive" },
  } as const;
  const cfg = map[insight.severidade] ?? map.info;
  const Icon = cfg.Icon;
  return (
    <div className={cn("rounded-lg border p-4", cfg.color)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.text)} />
        <div className="flex-1">
          <div className="font-medium text-foreground text-sm">{insight.titulo}</div>
          <div className="mt-1 text-xs text-muted-foreground">{insight.descricao}</div>
          <div className="mt-2 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ação: </span>
            <span className="text-foreground">{insight.acao}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: "primary" | "accent" | "success" | "destructive" | "muted";
}) {
  const accentMap = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5 bg-gradient-surface border-border/60 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-3xl text-foreground tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function RoadmapItem({ done, label }: { done?: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

function ActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-card"
    >
      {label}
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
