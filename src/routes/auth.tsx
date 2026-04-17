import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Pizza, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — LLum Pizzaria" },
      { name: "description", content: "Acesse o sistema 360 da LLum Pizzaria." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/" });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl, data: { nome } },
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Verifique seu email se a confirmação estiver ativa.");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-gradient-surface border-r border-border">
        <div className="absolute inset-0 bg-gradient-glow opacity-60" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-ember shadow-elegant">
              <Pizza className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-2xl text-foreground">LLum</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Pizzaria · Curitiba
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" />
              Motor de IA · Otimização de recursos
            </div>
            <h1 className="font-display text-5xl leading-tight text-foreground">
              O cérebro <span className="text-gradient-ember">operacional</span>
              <br /> da sua pizzaria.
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              Fichas técnicas, CMV em tempo real, motor de demanda e consultor IA.
              Decisões certas, sem desperdício, sem achismo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <Stat label="Visibilidade" value="360°" />
            <Stat label="CMV" value="Real-time" />
            <Stat label="IA" value="24/7" />
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full md:w-1/2 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-ember shadow-elegant">
              <Pizza className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-xl text-foreground">LLum Pizzaria</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Sistema 360
              </div>
            </div>
          </div>

          <h2 className="font-display text-3xl text-foreground">
            {mode === "signin" ? "Bem-vindo de volta" : "Criar acesso"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Entre com sua conta para acessar o painel."
              : "O primeiro usuário se torna administrador automaticamente."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  placeholder="João da Silva"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@llumpizzaria.com.br"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-ember text-primary-foreground shadow-elegant hover:opacity-95"
              size="lg"
            >
              {submitting
                ? "Aguarde..."
                : mode === "signin"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Ainda não tem acesso? " : "Já tem conta? "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Criar conta" : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3 backdrop-blur">
      <div className="font-display text-lg text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
