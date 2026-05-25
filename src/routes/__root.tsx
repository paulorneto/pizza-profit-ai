import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";

interface MyRouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A rota que você buscou não existe nesse sistema.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-ember px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02]"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LLum Pizzaria — Sistema 360 com IA" },
      {
        name: "description",
        content:
          "Gestão 360 da pizzaria LLum: fichas técnicas, estoque inteligente, motor de demanda e consultor IA.",
      },
      { name: "author", content: "LLum Pizzaria" },
      { property: "og:title", content: "LLum Pizzaria — Sistema 360 com IA" },
      {
        property: "og:description",
        content:
          "Plataforma de otimização de recursos com previsão de produção, controle de CMV em tempo real e consultor IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "LLum Pizzaria — Sistema 360 com IA" },
      { name: "description", content: "AI-powered system for pizzeria resource optimization and demand-driven management." },
      { property: "og:description", content: "AI-powered system for pizzeria resource optimization and demand-driven management." },
      { name: "twitter:description", content: "AI-powered system for pizzeria resource optimization and demand-driven management." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9599744c-be08-4259-9b8c-d22f695dc9e2/id-preview-80ce436c--f75e558d-177f-4cb0-ab8e-f71129c023fe.lovable.app-1776908951049.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9599744c-be08-4259-9b8c-d22f695dc9e2/id-preview-80ce436c--f75e558d-177f-4cb0-ab8e-f71129c023fe.lovable.app-1776908951049.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "var(--card)",
              color: "var(--card-foreground)",
              border: "1px solid var(--border)",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
