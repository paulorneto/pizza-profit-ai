import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Token",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const PayloadSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  pessoas_esperadas: z.number().int().min(1).max(2000),
  ticket_medio: z.number().min(0).max(1000).optional(),
  observacoes: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/webhooks/n8n")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        try {
          // 1. Token via header
          const token =
            request.headers.get("x-webhook-token") ||
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

          if (!token) {
            return json({ error: "Token ausente. Use header X-Webhook-Token." }, 401);
          }

          // 2. Validar token via RPC
          const { data: tokenId, error: tokenError } = await supabaseAdmin.rpc(
            "validar_token_webhook" as never,
            { _token: token } as never,
          );

          if (tokenError || !tokenId) {
            return json({ error: "Token inválido ou expirado." }, 401);
          }

          // 3. Validar payload
          const body = await request.json().catch(() => null);
          const parsed = PayloadSchema.safeParse(body);
          if (!parsed.success) {
            return json(
              { error: "Payload inválido", details: parsed.error.flatten() },
              400,
            );
          }

          // 4. Criar ordem
          const { data: ordemId, error: rpcError } = await supabaseAdmin.rpc(
            "criar_ordem_via_webhook" as never,
            {
              _data: parsed.data.data,
              _pessoas: parsed.data.pessoas_esperadas,
              _ticket: parsed.data.ticket_medio ?? 89.9,
              _origem: "n8n",
            } as never,
          );

          if (rpcError) {
            console.error("[webhook n8n] erro ao criar ordem:", rpcError);
            return json({ error: "Falha ao criar ordem", details: rpcError.message }, 500);
          }

          // 5. Buscar resumo
          const { data: ordem } = await supabaseAdmin
            .from("ordens_producao")
            .select("id, data_operacao, pessoas_esperadas, custo_previsto, cmv_previsto_pct, status")
            .eq("id", ordemId as string)
            .single();

          return json({
            success: true,
            ordem,
            mensagem: `Ordem criada para ${parsed.data.pessoas_esperadas} pessoas em ${parsed.data.data}`,
          });
        } catch (err) {
          console.error("[webhook n8n] erro inesperado:", err);
          return json({ error: "Erro interno" }, 500);
        }
      },
    },
  },
});
