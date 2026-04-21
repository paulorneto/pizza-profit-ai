import * as React from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ChefHat,
  UtensilsCrossed,
  Users,
  LogOut,
  Sparkles,
  Truck,
  Menu,
  X,
  Boxes,
  Gauge,
  Flame,
  ClipboardCheck,
  Webhook,
  Bot,
  ScanLine,
  ClipboardList,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoLlum from "@/assets/logo-llum.png";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gerente", "cozinha", "estoque"] },
  { to: "/consultor", label: "Consultor IA 360", icon: Bot, roles: ["admin", "gerente"] },
  { to: "/producao", label: "Motor de Produção", icon: Flame, roles: ["admin", "gerente", "cozinha"] },
  { to: "/separacao", label: "Separação do dia", icon: ClipboardList, roles: ["admin", "gerente", "cozinha"] },
  { to: "/baixa", label: "Baixa rápida (tablet)", icon: ScanLine, roles: ["admin", "gerente", "cozinha", "estoque"] },
  { to: "/fechamento", label: "Fechamento do Dia", icon: ClipboardCheck, roles: ["admin", "gerente", "cozinha"] },
  { to: "/estoque", label: "Estoque", icon: Boxes, roles: ["admin", "gerente", "estoque"] },
  { to: "/insumos", label: "Insumos", icon: Package, roles: ["admin", "gerente", "estoque"] },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, roles: ["admin", "gerente", "estoque"] },
  { to: "/fichas", label: "Fichas Técnicas", icon: ChefHat, roles: ["admin", "gerente", "cozinha"] },
  { to: "/cardapio", label: "Cardápio do Buffet", icon: UtensilsCrossed, roles: ["admin", "gerente", "cozinha"] },
  { to: "/demanda", label: "Parâmetros de Demanda", icon: Gauge, roles: ["admin", "gerente"] },
  { to: "/webhooks", label: "Webhooks n8n", icon: Webhook, roles: ["admin"] },
  { to: "/equipe", label: "Equipe & Acessos", icon: Users, roles: ["admin"] },
];

export function AppShell() {
  const { user, roles, signOut, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth" });
  };

  const visibleNav = NAV.filter((item) => hasAnyRole(item.roles));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 transform bg-sidebar border-r border-sidebar-border transition-transform duration-200 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
              <img src={logoLlum} alt="LLUM" className="h-9 w-auto shrink-0" />
              <div className="min-w-0">
                <div className="font-display text-[15px] leading-tight text-sidebar-foreground tracking-tight">LLUM OS</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Sistema operacional
                </div>
              </div>
            </Link>
            <button
              type="button"
              className="md:hidden text-sidebar-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
            {visibleNav.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <div className="rounded-md bg-sidebar-accent/40 px-3 py-2.5 mb-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conectado</div>
              <div className="truncate text-[13px] font-medium text-sidebar-foreground mt-0.5">
                {user?.email}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="uppercase tracking-wider font-medium">LLUM OS</span>
              <span className="text-muted-foreground/60">·</span>
              <span>Sistema de decisão</span>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums uppercase tracking-wider">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
