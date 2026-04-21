// Consultor IA 360 - chat streaming com contexto completo da operação
// Modelo de buffet livre: pague R$89,90 e coma à vontade (pizzas + cozinha + bebidas + sorvete)
// CMV é calculado por PESSOA (não por porção), pois o ticket é fixo.
// Usa Lovable AI (google/gemini-2.5-flash) com tool calling para simulações.

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

// Modelo de precificação LLUM
const TICKET_CHEIO = 89.9;        // adulto sem reserva
const TICKET_RESERVADO = 84.9;    // adulto com taxa reserva R$5 abatida
const TICKET_INFANTIL = 49.9;
const TAXA_RESERVA = 5.0;

// ---------- Cálculo de CMV por pessoa ----------
// Soma TODAS as fichas ativas no cardápio do dia × porções/pessoa de cada uma.
// Considera que tudo está incluso no ticket: pizzas, buffet, refri, sorvete.
async function calcularCmvPorPessoa() {
  const [cardapio, params, fichas] = await Promise.all([
    admin.from("cardapio").select("ficha_id").eq("ativo", true),
    admin.from("parametros_demanda").select("ficha_id, porcoes_por_pessoa, peso_dia_semana").eq("ativo", true),
    admin.from("fichas_tecnicas").select("id, nome, cmv_por_porcao").eq("ativo", true),
  ]);

  const fichaIdsCardapio = new Set((cardapio.data ?? []).map((c) => c.ficha_id));
  const fichaMap = new Map((fichas.data ?? []).map((f) => [f.id, f]));

  let cmvTotalPorPessoa = 0;
  const detalhamento: Array<{ ficha: string; porcoes: number; cmv_pessoa: number }> = [];

  for (const p of params.data ?? []) {
    if (!fichaIdsCardapio.has(p.ficha_id)) continue;
    const ficha = fichaMap.get(p.ficha_id);
    if (!ficha) continue;
    const porcoes = Number(p.porcoes_por_pessoa) * Number(p.peso_dia_semana);
    const cmvPessoa = porcoes * Number(ficha.cmv_por_porcao);
    cmvTotalPorPessoa += cmvPessoa;
    detalhamento.push({
      ficha: ficha.nome,
      porcoes: Number(porcoes.toFixed(3)),
      cmv_pessoa: Number(cmvPessoa.toFixed(3)),
    });
  }

  return {
    cmv_por_pessoa: Number(cmvTotalPorPessoa.toFixed(3)),
    cmv_pct_no_ticket_cheio: Number(((cmvTotalPorPessoa / TICKET_CHEIO) * 100).toFixed(2)),
    cmv_pct_no_ticket_reservado: Number(((cmvTotalPorPessoa / TICKET_RESERVADO) * 100).toFixed(2)),
    detalhamento,
  };
}

// ---------- Carrega snapshot do negócio ----------
async function carregarContexto() {
  const [insumos, fichas, ordens, fechamentos, alertas, params, cardapio] =
    await Promise.all([
      admin
        .from("insumos")
        .select("nome, unidade, estoque_atual, ponto_reposicao, custo_medio, categoria")
        .eq("ativo", true),
      admin
        .from("fichas_tecnicas")
        .select("id, nome, categoria, cmv_por_porcao, rendimento_porcoes, preco_venda, ativo")
        .eq("ativo", true),
      admin
        .from("ordens_producao")
        .select("data_operacao, pessoas_esperadas, pessoas_reais, custo_previsto, custo_real, cmv_previsto_pct, cmv_real_pct, faturamento_real, status")
        .order("data_operacao", { ascending: false })
        .limit(15),
      admin
        .from("fechamentos_dia")
        .select("data_operacao, pessoas_reais, faturamento_real, ticket_real, custo_real, cmv_real_pct, sobras_total_kg, acerto_pessoas_pct, acerto_custo_pct")
        .order("data_operacao", { ascending: false })
        .limit(10),
      admin.from("v_alertas_estoque").select("nome, estoque_atual, ponto_reposicao, unidade, nivel"),
      admin
        .from("parametros_demanda")
        .select("ficha_id, porcoes_por_pessoa, peso_dia_semana, ativo")
        .eq("ativo", true),
      admin.from("cardapio").select("ficha_id, ativo").eq("ativo", true),
    ]);

  const valorEstoque = (insumos.data ?? []).reduce(
    (a, i) => a + Number(i.estoque_atual) * Number(i.custo_medio),
    0,
  );

  const cmv = await calcularCmvPorPessoa();

  return {
    modelo_negocio: {
      tipo: "buffet livre rodízio",
      ticket_cheio_brl: TICKET_CHEIO,
      ticket_reservado_brl: TICKET_RESERVADO,
      ticket_infantil_brl: TICKET_INFANTIL,
      taxa_reserva_brl: TAXA_RESERVA,
      politica: "pague R$89,90 e coma à vontade — pizzas, buffet de cozinha, refrigerante, sorvete e brinquedos",
    },
    cmv_atual: cmv,
    resumo: {
      total_insumos: insumos.data?.length ?? 0,
      valor_estoque_brl: Number(valorEstoque.toFixed(2)),
      total_fichas: fichas.data?.length ?? 0,
      itens_cardapio_ativo: cardapio.data?.length ?? 0,
      alertas_estoque: alertas.data?.length ?? 0,
      ordens_recentes: ordens.data?.length ?? 0,
    },
    insumos: insumos.data ?? [],
    fichas: fichas.data ?? [],
    parametros_demanda: params.data ?? [],
    cardapio_ativo: cardapio.data ?? [],
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
        "Simula consumo total e CMV por pessoa para X pessoas em uma operação de buffet livre. Use para 'e se vierem N pessoas'.",
      parameters: {
        type: "object",
        properties: {
          pessoas: { type: "number", description: "Número de pessoas esperadas" },
          ticket_medio: {
            type: "number",
            description: "Ticket médio em R$ (default 89.90 sem reserva, 84.90 com reserva abatida)",
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
        "Simula impacto no CMV por pessoa caso o custo de um insumo suba X%. Mostra impacto consolidado no ticket de buffet.",
      parameters: {
        type: "object",
        properties: {
          insumo_nome: { type: "string" },
          variacao_pct: { type: "number" },
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
      description: "Verifica se o estoque cobre a produção para X pessoas. Lista faltantes.",
      parameters: {
        type: "object",
        properties: { pessoas: { type: "number" } },
        required: ["pessoas"],
        additionalProperties: false,
      },
    },
  },
];

async function execTool(name: string, args: Record<string, unknown>) {
  if (name === "simular_demanda") {
    const pessoas = Number(args.pessoas) || 0;
    const ticket = Number(args.ticket_medio) || TICKET_CHEIO;
    const cmv = await calcularCmvPorPessoa();
    const custoTotal = cmv.cmv_por_pessoa * pessoas;
    const faturamento = pessoas * ticket;
    return {
      pessoas,
      ticket_medio: ticket,
      cmv_por_pessoa: cmv.cmv_por_pessoa,
      faturamento_estimado: Number(faturamento.toFixed(2)),
      custo_previsto: Number(custoTotal.toFixed(2)),
      cmv_pct: faturamento > 0 ? Number(((custoTotal / faturamento) * 100).toFixed(2)) : null,
      margem_bruta: Number((faturamento - custoTotal).toFixed(2)),
      detalhamento_por_ficha: cmv.detalhamento.map((d) => ({
        ficha: d.ficha,
        porcoes_totais: Number((d.porcoes * pessoas).toFixed(2)),
        custo_brl: Number((d.cmv_pessoa * pessoas).toFixed(2)),
      })),
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
      .select("quantidade, custo_item, ficha_id, fichas_tecnicas!inner(id, nome, cmv_calculado, rendimento_porcoes, cmv_por_porcao)")
      .eq("insumo_id", insumo.id);

    // Calcular impacto agregado por pessoa
    const cmvAtual = await calcularCmvPorPessoa();
    const params = await admin.from("parametros_demanda").select("ficha_id, porcoes_por_pessoa, peso_dia_semana").eq("ativo", true);
    const cardapio = await admin.from("cardapio").select("ficha_id").eq("ativo", true);
    const fichaIdsCardapio = new Set((cardapio.data ?? []).map((c) => c.ficha_id));
    const paramsMap = new Map((params.data ?? []).map((p) => [p.ficha_id, Number(p.porcoes_por_pessoa) * Number(p.peso_dia_semana)]));

    let deltaTotalPorPessoa = 0;
    const impactos = (itens ?? []).map((it: any) => {
      const novoItem = Number(it.quantidade) * novoCusto;
      const delta = novoItem - Number(it.custo_item);
      const novoCmv = Number(it.fichas_tecnicas.cmv_calculado) + delta;
      const novoCmvPorcao = Number(it.fichas_tecnicas.rendimento_porcoes) > 0
        ? novoCmv / Number(it.fichas_tecnicas.rendimento_porcoes) : 0;
      const deltaPorcao = novoCmvPorcao - Number(it.fichas_tecnicas.cmv_por_porcao);
      // Se a ficha está no cardápio, somar ao impacto por pessoa
      if (fichaIdsCardapio.has(it.ficha_id)) {
        const porcoesPessoa = paramsMap.get(it.ficha_id) ?? 0;
        deltaTotalPorPessoa += deltaPorcao * porcoesPessoa;
      }
      return {
        ficha: it.fichas_tecnicas.nome,
        cmv_porcao_atual: Number(it.fichas_tecnicas.cmv_por_porcao),
        cmv_porcao_simulado: Number(novoCmvPorcao.toFixed(4)),
        no_cardapio: fichaIdsCardapio.has(it.ficha_id),
      };
    });

    return {
      insumo: insumo.nome,
      custo_atual: Number(insumo.custo_medio),
      custo_simulado: Number(novoCusto.toFixed(4)),
      variacao_pct: Number(args.variacao_pct),
      cmv_por_pessoa_atual: cmvAtual.cmv_por_pessoa,
      cmv_por_pessoa_simulado: Number((cmvAtual.cmv_por_pessoa + deltaTotalPorPessoa).toFixed(3)),
      impacto_pct_no_ticket: Number(((deltaTotalPorPessoa / TICKET_CHEIO) * 100).toFixed(3)),
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
      const { data: ficha } = await admin.from("fichas_tecnicas").select("rendimento_porcoes").eq("id", p.ficha_id).single();
      const rend = Number(ficha?.rendimento_porcoes) || 1;
      const { data: itens } = await admin
        .from("ficha_itens")
        .select("quantidade, insumos!inner(id, nome, unidade, estoque_atual)")
        .eq("ficha_id", p.ficha_id);
      for (const it of itens ?? []) {
        const ins = (it as any).insumos;
        const consumo = (Number(it.quantidade) / rend) * porcoes;
        const cur = necessidade[ins.id] ?? { necessario: 0, nome: ins.nome, unidade: ins.unidade, estoque: Number(ins.estoque_atual) };
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
    return { pessoas, itens: lista, faltantes: lista.filter((l) => !l.cobre) };
  }

  return { erro: "tool desconhecida" };
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages = [] } = await req.json();
    const ctx = await carregarContexto();

    const systemPrompt = `Você é o **Consultor 360 da LLUM Pizzaria**, especialista em gestão de buffet livre rodízio.

MODELO DE NEGÓCIO:
- Buffet livre "pague R$89,90 e coma à vontade" — inclui pizzas, buffet de comida, refrigerante, sorvete, brinquedos e espaço.
- Cliente sem reserva: paga R$89,90 (adulto) / R$49,90 (criança 6-10).
- Cliente com taxa de reserva (R$5/pessoa antecipada): paga R$84,90 (adulto) / R$44,90 (criança) na entrada. Menores de 5 anos: gratuito, R$5 não abatido.
- **CMV é calculado por PESSOA**, não por porção, porque o ticket é fixo.
  Fórmula: CMV/pessoa = Σ (porções/pessoa × CMV/porção) de todas as fichas ATIVAS NO CARDÁPIO do dia.
  CMV% = CMV/pessoa ÷ ticket (use R$84,90 como ticket médio padrão pois maioria reserva).

PERSONALIDADE:
- Direto, prático, voltado a R$ e CMV.
- Tom profissional mas próximo (você fala com sócios).
- Sempre dê números concretos (R$, %, kg). Sugira ações, não só descreva problemas.

REGRAS:
- Use as ferramentas (simular_demanda, simular_alta_insumo, estoque_para_demanda) sempre que envolver "e se", projeção ou checagem.
- Não invente dados. Se faltar info no contexto, peça.
- Formate em Markdown com listas, **negrito** e tabelas.

CONTEXTO ATUAL:
${JSON.stringify(ctx, null, 2)}`;

    let convo: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    for (let round = 0; round < 4; round++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      });

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições. Aguarde alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos no workspace para continuar." }),
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

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return new Response(
          JSON.stringify({ content: msg.content ?? "", tool_calls_executed: round }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

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
