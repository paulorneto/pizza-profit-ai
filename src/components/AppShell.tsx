import * as React from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ChefHat,
  UtensilsCrossed,
  Users,
  LogOut,
  Pizza,
  Sparkles,
  Truck,
  Menu,
  X,
  Boxes,
  Gauge,
  Flame,
  ClipboardCheck,
  Webhook,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gerente", "cozinha", "estoque"] },
  { to: "/producao", label: "Motor de Produção", icon: Flame, roles: ["admin", "gerente", "cozinha"] },
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
          "fixed inset-y-0 left-0 z-40 w-72 transform bg-sidebar border-r border-sidebar-border transition-transform duration-200 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-6 py-6 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-ember shadow-elegant">
                <Pizza className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="font-display text-xl leading-tight text-sidebar-foreground">LLum</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Pizzaria · 360
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

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {visibleNav.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-primary")} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="rounded-lg bg-sidebar-accent/40 p-3 mb-3">
              <div className="text-xs text-muted-foreground">Conectado como</div>
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.email}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-2">
              <LogOut className="h-4 w-4" />
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
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Sistema 360 com motor de IA
            </div>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
