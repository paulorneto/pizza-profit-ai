// Consultor IA 360 - chat streaming com contexto completo da operação
// Usa Lovable AI (google/gemini-2.5-flash por padrão) com tool calling
// para simulações de cenário (demanda variável, alta de insumo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------- Carrega snapshot do negócio ----------
async function carregarContexto() {
  const [insumos, fichas, ordens, fechamentos, alertas, params] =
    await Promise.all([
      admin
        .from("insumos")
        .select(
          "nome, unidade, estoque_atual, ponto_reposicao, custo_medio, categoria",
        )
        .eq("ativo", true),
      admin
        .from("fichas_tecnicas")
        .select(
          "id, nome, categoria, cmv_por_porcao, rendimento_porcoes, preco_venda, ativo",
        )
        .eq("ativo", true),
      admin
        .from("ordens_producao")
        .select(
          "data_operacao, pessoas_esperadas, pessoas_reais, custo_previsto, custo_real, cmv_previsto_pct, cmv_real_pct, faturamento_real, status",
        )
        .order("data_operacao", { ascending: false })
        .limit(15),
      admin
        .from("fechamentos_dia")
        .select(
          "data_operacao, pessoas_reais, faturamento_real, ticket_real, custo_real, cmv_real_pct, sobras_total_kg, acerto_pessoas_pct, acerto_custo_pct",
        )
        .order("data_operacao", { ascending: false })
        .limit(10),
      admin.from("v_alertas_estoque").select("nome, estoque_atual, ponto_reposicao, unidade, nivel"),
      admin
        .from("parametros_demanda")
        .select("ficha_id, porcoes_por_pessoa, peso_dia_semana, ativo")
        .eq("ativo", true),
    ]);

  const valorEstoque = (insumos.data ?? []).reduce(
    (a, i) => a + Number(i.estoque_atual) * Number(i.custo_medio),
    0,
  );

  return {
    resumo: {
      total_insumos: insumos.data?.length ?? 0,
      valor_estoque_brl: Number(valorEstoque.toFixed(2)),
      total_fichas: fichas.data?.length ?? 0,
      alertas_estoque: alertas.data?.length ?? 0,
      ordens_recentes: ordens.data?.length ?? 0,
    },
    insumos: insumos.data ?? [],
    fichas: fichas.data ?? [],
    parametros_demanda: params.data ?? [],
    ordens_recentes: ordens.data ?? [],
    fechamentos_recentes: fechamentos.data ?? [],
    alertas_estoque: alertas.data ?? [],
  };
}

// ---------- Tools (simulações) ----------
const tools = [
  {
    type: "function",
    function: {
      name: "simular_demanda",
      description:
        "Simula a produção e o custo previsto para X pessoas em uma data, sem persistir nada. Use quando o usuário perguntar 'e se vierem N pessoas'.",
      parameters: {
        type: "object",
        properties: {
          pessoas: { type: "number", description: "Número de pessoas esperadas" },
          ticket_medio: {
            type: "number",
            description: "Ticket médio em R$ (default 89.90)",
          },
        },
        required: ["pessoas"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simular_alta_insumo",
      description:
        "Simula o impacto no CMV de cada ficha técnica caso o custo de um insumo suba X%. Use para 'e se a mussarela subir 15%'.",
      parameters: {
        type: "object",
        properties: {
          insumo_nome: {
            type: "string",
            description: "Nome (ou parte) do insumo, ex: 'mussarela'",
          },
          variacao_pct: {
            type: "number",
            description: "Variação em % (15 = +15%, -10 = redução de 10%)",
          },
        },
        required: ["insumo_nome", "variacao_pct"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estoque_para_demanda",
      description:
        "Verifica se o estoque atual cobre a produção para X pessoas. Lista insumos faltantes e quantidade a comprar.",
      parameters: {
        type: "object",
        properties: {
          pessoas: { type: "number" },
        },
        required: ["pessoas"],
        additionalProperties: false,
      },
    },
  },
];

// ---------- Implementação das tools ----------
async function execTool(name: string, args: Record<string, unknown>) {
  if (name === "simular_demanda") {
    const pessoas = Number(args.pessoas) || 0;
    const ticket = Number(args.ticket_medio) || 89.9;
    const { data: params } = await admin
      .from("parametros_demanda")
      .select(
        "porcoes_por_pessoa, peso_dia_semana, fichas_tecnicas!inner(id, nome, cmv_por_porcao)",
      )
      .eq("ativo", true);
    let custoTotal = 0;
    const itens: Array<Record<string, unknown>> = [];
    for (const p of params ?? []) {
      const f = (p as any).fichas_tecnicas;
      const porcoes =
        pessoas * Number(p.porcoes_por_pessoa) * Number(p.peso_dia_semana);
      const custo = porcoes * Number(f.cmv_por_porcao);
      custoTotal += custo;
      itens.push({
        ficha: f.nome,
        porcoes: Number(porcoes.toFixed(2)),
        custo_brl: Number(custo.toFixed(2)),
      });
    }
    const faturamento = pessoas * ticket;
    return {
      pessoas,
      ticket_medio: ticket,
      faturamento_estimado: Number(faturamento.toFixed(2)),
      custo_previsto: Number(custoTotal.toFixed(2)),
      cmv_pct: faturamento > 0 ? Number(((custoTotal / faturamento) * 100).toFixed(2)) : null,
      itens,
    };
  }

  if (name === "simular_alta_insumo") {
    const nome = String(args.insumo_nome).toLowerCase();
    const variacao = Number(args.variacao_pct) / 100;
    const { data: insumo } = await admin
      .from("insumos")
      .select("id, nome, custo_medio, unidade")
      .ilike("nome", `%${nome}%`)
      .limit(1)
      .single();
    if (!insumo) return { erro: `Insumo não encontrado: ${nome}` };

    const novoCusto = Number(insumo.custo_medio) * (1 + variacao);
    const { data: itens } = await admin
      .from("ficha_itens")
      .select(
        "quantidade, custo_item, ficha_id, fichas_tecnicas!inner(id, nome, cmv_calculado, rendimento_porcoes, cmv_por_porcao)",
      )
      .eq("insumo_id", insumo.id);

    const impactos = (itens ?? []).map((it: any) => {
      const novoItem = Number(it.quantidade) * novoCusto;
      const delta = novoItem - Number(it.custo_item);
      const novoCmv = Number(it.fichas_tecnicas.cmv_calculado) + delta;
      const novoCmvPorcao =
        Number(it.fichas_tecnicas.rendimento_porcoes) > 0
          ? novoCmv / Number(it.fichas_tecnicas.rendimento_porcoes)
          : 0;
      return {
        ficha: it.fichas_tecnicas.nome,
        cmv_porcao_atual: Number(it.fichas_tecnicas.cmv_por_porcao),
        cmv_porcao_simulado: Number(novoCmvPorcao.toFixed(4)),
        variacao_porcao_brl: Number(
          (novoCmvPorcao - Number(it.fichas_tecnicas.cmv_por_porcao)).toFixed(4),
        ),
      };
    });

    return {
      insumo: insumo.nome,
      custo_atual: Number(insumo.custo_medio),
      custo_simulado: Number(novoCusto.toFixed(4)),
      variacao_pct: Number(args.variacao_pct),
      fichas_afetadas: impactos.length,
      impactos,
    };
  }

  if (name === "estoque_para_demanda") {
    const pessoas = Number(args.pessoas);
    const { data: params } = await admin
      .from("parametros_demanda")
      .select("porcoes_por_pessoa, peso_dia_semana, ficha_id")
      .eq("ativo", true);

    const necessidade: Record<string, { necessario: number; nome: string; unidade: string; estoque: number }> = {};
    for (const p of params ?? []) {
      const porcoes = pessoas * Number(p.porcoes_por_pessoa) * Number(p.peso_dia_semana);
      const { data: ficha } = await admin
        .from("fichas_tecnicas")
        .select("rendimento_porcoes")
        .eq("id", p.ficha_id)
        .single();
      const rend = Number(ficha?.rendimento_porcoes) || 1;
      const { data: itens } = await admin
        .from("ficha_itens")
        .select("quantidade, insumos!inner(id, nome, unidade, estoque_atual)")
        .eq("ficha_id", p.ficha_id);
      for (const it of itens ?? []) {
        const ins = (it as any).insumos;
        const consumo = (Number(it.quantidade) / rend) * porcoes;
        const cur = necessidade[ins.id] ?? {
          necessario: 0,
          nome: ins.nome,
          unidade: ins.unidade,
          estoque: Number(ins.estoque_atual),
        };
        cur.necessario += consumo;
        necessidade[ins.id] = cur;
      }
    }

    const lista = Object.values(necessidade).map((n) => ({
      ...n,
      necessario: Number(n.necessario.toFixed(3)),
      faltante: Number(Math.max(0, n.necessario - n.estoque).toFixed(3)),
      cobre: n.estoque >= n.necessario,
    }));

    return {
      pessoas,
      itens: lista,
      faltantes: lista.filter((l) => !l.cobre),
    };
  }

  return { erro: "tool desconhecida" };
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages = [] } = await req.json();

    const ctx = await carregarContexto();

    const systemPrompt = `Você é o **Consultor 360 da LLum Pizzaria**, especialista em gestão de buffet livre.

PERSONALIDADE:
- Direto, prático, voltado a R$ e CMV.
- Fala português do Brasil, tom profissional mas próximo (você está conversando com sócios).
- Sempre que possível, dê números concretos (R$, %, kg).
- Sugira ações, não fique só descrevendo o problema.

REGRAS:
- Use as ferramentas (simular_demanda, simular_alta_insumo, estoque_para_demanda) sempre que a pergunta envolver "e se", projeção, simulação ou checagem de cobertura de estoque.
- Não invente dados. Se faltar info no contexto, peça ou sugira coletar.
- Formate em Markdown com listas, **negrito** e tabelas quando ajudar.

CONTEXTO ATUAL (snapshot da operação):
${JSON.stringify(ctx, null, 2)}`;

    // Loop de tool calling — até 4 rodadas
    let convo: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    for (let round = 0; round < 4; round++) {
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
            messages: convo,
            tools,
            stream: false,
          }),
        },
      );

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições. Aguarde alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos esgotados. Adicione créditos no workspace para continuar.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI error", aiResp.status, t);
        return new Response(JSON.stringify({ error: "Falha no gateway IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "Resposta vazia" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sem tool_calls → resposta final
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return new Response(
          JSON.stringify({ content: msg.content ?? "", tool_calls_executed: round }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Executa tools
      convo.push(msg);
      for (const call of msg.tool_calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsed = {};
        }
        const result = await execTool(call.function.name, parsed);
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(
      JSON.stringify({ content: "Não consegui concluir o raciocínio em 4 rodadas." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("consultor-ia error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
