// Insights proativos para o dashboard — JSON estruturado
// Modelo de negócio: buffet livre rodízio. CMV calculado POR PESSOA.
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

const TICKET_REFERENCIA = 84.9; // ticket médio com taxa reserva abatida

async function calcularCmvPorPessoa() {
  const [cardapio, params, fichas] = await Promise.all([
    admin.from("cardapio").select("ficha_id").eq("ativo", true),
    admin.from("parametros_demanda").select("ficha_id, porcoes_por_pessoa, peso_dia_semana").eq("ativo", true),
    admin.from("fichas_tecnicas").select("id, nome, cmv_por_porcao").eq("ativo", true),
  ]);
  const fichaIds = new Set((cardapio.data ?? []).map((c) => c.ficha_id));
  const fichaMap = new Map((fichas.data ?? []).map((f) => [f.id, f]));
  let total = 0;
  for (const p of params.data ?? []) {
    if (!fichaIds.has(p.ficha_id)) continue;
    const f = fichaMap.get(p.ficha_id);
    if (!f) continue;
    total += Number(p.porcoes_por_pessoa) * Number(p.peso_dia_semana) * Number(f.cmv_por_porcao);
  }
  return {
    cmv_por_pessoa: Number(total.toFixed(3)),
    cmv_pct: Number(((total / TICKET_REFERENCIA) * 100).toFixed(2)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const [alertas, fechamentos, ordens] = await Promise.all([
      admin.from("v_alertas_estoque").select("*"),
      admin
        .from("fechamentos_dia")
        .select("data_operacao, cmv_real_pct, ticket_real, sobras_total_kg, acerto_pessoas_pct, acerto_custo_pct, pessoas_reais")
        .order("data_operacao", { ascending: false })
        .limit(7),
      admin
        .from("ordens_producao")
        .select("data_operacao, status, pessoas_esperadas, custo_previsto")
        .order("data_operacao", { ascending: false })
        .limit(5),
    ]);

    const cmv = await calcularCmvPorPessoa();

    const snapshot = {
      modelo: "buffet livre rodízio - ticket médio R$84,90 (com taxa reserva) / R$89,90 (cheio)",
      cmv_atual_por_pessoa: cmv,
      alertas_estoque: alertas.data ?? [],
      ultimos_fechamentos: fechamentos.data ?? [],
      ordens_recentes: ordens.data ?? [],
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Você analisa operação de BUFFET LIVRE de pizzaria (LLUM).
Modelo: cliente paga ticket fixo (R$89,90 cheio / R$84,90 com reserva) e come à vontade.
CMV é POR PESSOA = soma de todas fichas ativas no cardápio × porções/pessoa.
Retorne 3-5 insights acionáveis na tool insights. Severidade: info/warn/critical.
Foque em: tendência CMV, sobras (desperdício R$), rupturas iminentes, acerto previsão de pessoas.
Cada ação deve ser concreta (números).`,
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
    });

    if (aiResp.status === 429 || aiResp.status === 402) {
      return new Response(
        JSON.stringify({
          error: aiResp.status === 429 ? "Limite de requisições, aguarde." : "Créditos IA esgotados.",
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
