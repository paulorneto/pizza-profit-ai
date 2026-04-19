// Insights proativos para o dashboard — JSON estruturado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const [alertas, fechamentos, ordens] = await Promise.all([
      admin.from("v_alertas_estoque").select("*"),
      admin
        .from("fechamentos_dia")
        .select(
          "data_operacao, cmv_real_pct, ticket_real, sobras_total_kg, acerto_pessoas_pct, acerto_custo_pct, pessoas_reais",
        )
        .order("data_operacao", { ascending: false })
        .limit(7),
      admin
        .from("ordens_producao")
        .select("data_operacao, status, pessoas_esperadas, custo_previsto")
        .order("data_operacao", { ascending: false })
        .limit(5),
    ]);

    const snapshot = {
      alertas_estoque: alertas.data ?? [],
      ultimos_fechamentos: fechamentos.data ?? [],
      ordens_recentes: ordens.data ?? [],
    };

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você analisa operação de buffet de pizzaria. Retorne 3-5 insights acionáveis usando a tool insights. Cada insight deve ter severidade (info/warn/critical), título curto e uma ação concreta. Pense em CMV, tendência, sobras, rupturas, acerto de previsão.",
            },
            { role: "user", content: JSON.stringify(snapshot) },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "insights",
                description: "Retorna insights priorizados",
                parameters: {
                  type: "object",
                  properties: {
                    insights: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          severidade: { type: "string", enum: ["info", "warn", "critical"] },
                          titulo: { type: "string" },
                          descricao: { type: "string" },
                          acao: { type: "string" },
                        },
                        required: ["severidade", "titulo", "descricao", "acao"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["insights"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "insights" } },
        }),
      },
    );

    if (aiResp.status === 429 || aiResp.status === 402) {
      return new Response(
        JSON.stringify({
          error:
            aiResp.status === 429
              ? "Limite de requisições, aguarde."
              : "Créditos IA esgotados.",
        }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      return new Response(JSON.stringify({ error: "Falha IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { insights: [] };

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("insights error", e);
    return new Response(JSON.stringify({ error: "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
