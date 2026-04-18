-- ============================================
-- 1. WEBHOOK TOKENS
-- ============================================
CREATE TABLE public.webhook_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ,
  ultimo_uso TIMESTAMPTZ,
  total_chamadas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_tokens_hash ON public.webhook_tokens(token_hash) WHERE ativo = true;

ALTER TABLE public.webhook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_tokens_admin_all"
  ON public.webhook_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. FECHAMENTOS DIA
-- ============================================
CREATE TABLE public.fechamentos_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id UUID NOT NULL UNIQUE REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  data_operacao DATE NOT NULL,
  pessoas_reais INTEGER NOT NULL,
  faturamento_real NUMERIC(12,2) NOT NULL,
  ticket_real NUMERIC(10,2),
  custo_real NUMERIC(12,2) NOT NULL DEFAULT 0,
  cmv_real_pct NUMERIC(6,3),
  sobras_total_kg NUMERIC(12,4) DEFAULT 0,
  acerto_pessoas_pct NUMERIC(6,3),
  acerto_custo_pct NUMERIC(6,3),
  observacoes TEXT,
  fechado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fechamentos_data ON public.fechamentos_dia(data_operacao DESC);

ALTER TABLE public.fechamentos_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fechamentos_select"
  ON public.fechamentos_dia FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fechamentos_write"
  ON public.fechamentos_dia FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'cozinha')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'cozinha')
  );

-- ============================================
-- 3. TOKEN MANAGEMENT FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.gerar_token_webhook(_nome TEXT, _expira_em TIMESTAMPTZ DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
  v_prefix TEXT;
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar tokens';
  END IF;

  -- token aleatório de 48 chars
  v_token := 'llum_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_prefix := substr(v_token, 1, 12);

  INSERT INTO public.webhook_tokens (nome, token_hash, token_prefix, criado_por, expira_em)
  VALUES (_nome, v_hash, v_prefix, auth.uid(), _expira_em)
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'token', v_token, 'prefix', v_prefix);
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_token_webhook(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_id UUID;
BEGIN
  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT id INTO v_id
  FROM public.webhook_tokens
  WHERE token_hash = v_hash
    AND ativo = true
    AND (expira_em IS NULL OR expira_em > now());

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.webhook_tokens
    SET ultimo_uso = now(),
        total_chamadas = total_chamadas + 1
  WHERE id = v_id;

  RETURN v_id;
END;
$$;

-- ============================================
-- 4. CRIAR ORDEM VIA WEBHOOK (security definer, não exige auth.uid)
-- ============================================
CREATE OR REPLACE FUNCTION public.criar_ordem_via_webhook(
  _data DATE,
  _pessoas INTEGER,
  _ticket NUMERIC DEFAULT 89.90,
  _origem TEXT DEFAULT 'n8n'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_id UUID;
  v_total_custo NUMERIC(12,2) := 0;
  r RECORD;
  v_porcoes NUMERIC(10,2);
  v_custo NUMERIC(12,4);
BEGIN
  INSERT INTO public.ordens_producao
    (data_operacao, pessoas_esperadas, ticket_medio, origem, status)
  VALUES (_data, _pessoas, _ticket, _origem, 'confirmada')
  RETURNING id INTO v_ordem_id;

  FOR r IN
    SELECT f.id AS ficha_id, f.cmv_por_porcao, p.porcoes_por_pessoa, p.peso_dia_semana
      FROM public.parametros_demanda p
      JOIN public.fichas_tecnicas f ON f.id = p.ficha_id
     WHERE p.ativo = true AND f.ativo = true
  LOOP
    v_porcoes := ROUND(_pessoas * r.porcoes_por_pessoa * r.peso_dia_semana, 2);
    v_custo := ROUND(v_porcoes * r.cmv_por_porcao, 4);
    v_total_custo := v_total_custo + v_custo;

    INSERT INTO public.ordem_itens
      (ordem_id, ficha_id, porcoes_previstas, custo_previsto)
    VALUES (v_ordem_id, r.ficha_id, v_porcoes, v_custo);
  END LOOP;

  UPDATE public.ordens_producao
    SET custo_previsto = v_total_custo,
        cmv_previsto_pct = CASE
          WHEN _pessoas > 0 AND _ticket > 0
            THEN ROUND((v_total_custo / (_pessoas * _ticket)) * 100, 3)
          ELSE NULL END
    WHERE id = v_ordem_id;

  RETURN v_ordem_id;
END;
$$;

-- ============================================
-- 5. FECHAMENTO DO DIA
-- input: itens_reais = jsonb array de { ordem_item_id, porcoes_consumidas, sobras }
-- ============================================
CREATE OR REPLACE FUNCTION public.fechar_ordem_producao(
  _ordem_id UUID,
  _pessoas_reais INTEGER,
  _faturamento_real NUMERIC,
  _itens_reais JSONB,
  _observacoes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fechamento_id UUID;
  v_data DATE;
  v_pessoas_esperadas INTEGER;
  v_custo_previsto NUMERIC(12,2);
  v_custo_real NUMERIC(12,2) := 0;
  v_sobras_total NUMERIC(12,4) := 0;
  v_ticket_real NUMERIC(10,2);
  v_cmv_real_pct NUMERIC(6,3);
  v_acerto_pessoas NUMERIC(6,3);
  v_acerto_custo NUMERIC(6,3);
  r JSONB;
  v_item RECORD;
  v_ingred RECORD;
  v_qtd_consumida NUMERIC(12,4);
BEGIN
  -- Permissão
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'cozinha')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para fechar ordem';
  END IF;

  SELECT data_operacao, pessoas_esperadas, custo_previsto
    INTO v_data, v_pessoas_esperadas, v_custo_previsto
    FROM public.ordens_producao
    WHERE id = _ordem_id;

  IF v_data IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  -- Itera os itens reais
  FOR r IN SELECT * FROM jsonb_array_elements(_itens_reais)
  LOOP
    UPDATE public.ordem_itens
      SET porcoes_consumidas = (r->>'porcoes_consumidas')::NUMERIC,
          sobras = COALESCE((r->>'sobras')::NUMERIC, 0)
    WHERE id = (r->>'ordem_item_id')::UUID
    RETURNING * INTO v_item;

    v_sobras_total := v_sobras_total + COALESCE(v_item.sobras, 0);

    -- Para cada insumo da ficha, baixar do estoque proporcional ao consumido
    SELECT rendimento_porcoes INTO v_qtd_consumida
      FROM public.fichas_tecnicas WHERE id = v_item.ficha_id;

    IF v_qtd_consumida > 0 AND v_item.porcoes_consumidas > 0 THEN
      FOR v_ingred IN
        SELECT fi.insumo_id, fi.quantidade, fi.unidade, i.custo_medio
          FROM public.ficha_itens fi
          JOIN public.insumos i ON i.id = fi.insumo_id
         WHERE fi.ficha_id = v_item.ficha_id
      LOOP
        DECLARE
          v_consumo NUMERIC(12,4);
        BEGIN
          v_consumo := ROUND(
            (v_ingred.quantidade / v_qtd_consumida) * v_item.porcoes_consumidas, 4
          );

          IF v_consumo > 0 THEN
            INSERT INTO public.movimentos_estoque
              (insumo_id, tipo, quantidade, custo_unitario, custo_total,
               ordem_producao_id, registrado_por, observacoes)
            VALUES (
              v_ingred.insumo_id, 'saida_producao', v_consumo,
              v_ingred.custo_medio, v_consumo * v_ingred.custo_medio,
              _ordem_id, auth.uid(), 'Fechamento ordem'
            );

            v_custo_real := v_custo_real + (v_consumo * v_ingred.custo_medio);
          END IF;
        END;
      END LOOP;
    END IF;
  END LOOP;

  -- Cálculos
  v_ticket_real := CASE WHEN _pessoas_reais > 0
                        THEN ROUND(_faturamento_real / _pessoas_reais, 2)
                        ELSE NULL END;

  v_cmv_real_pct := CASE WHEN _faturamento_real > 0
                         THEN ROUND((v_custo_real / _faturamento_real) * 100, 3)
                         ELSE NULL END;

  v_acerto_pessoas := CASE WHEN v_pessoas_esperadas > 0
                           THEN ROUND(100 - ABS((_pessoas_reais - v_pessoas_esperadas)::NUMERIC / v_pessoas_esperadas) * 100, 3)
                           ELSE NULL END;

  v_acerto_custo := CASE WHEN v_custo_previsto > 0
                         THEN ROUND(100 - ABS((v_custo_real - v_custo_previsto)::NUMERIC / v_custo_previsto) * 100, 3)
                         ELSE NULL END;

  -- Atualiza ordem
  UPDATE public.ordens_producao
    SET status = 'concluida',
        pessoas_reais = _pessoas_reais,
        faturamento_real = _faturamento_real,
        custo_real = v_custo_real,
        cmv_real_pct = v_cmv_real_pct,
        observacoes = COALESCE(_observacoes, observacoes),
        updated_at = now()
    WHERE id = _ordem_id;

  -- Insere fechamento
  INSERT INTO public.fechamentos_dia
    (ordem_id, data_operacao, pessoas_reais, faturamento_real, ticket_real,
     custo_real, cmv_real_pct, sobras_total_kg,
     acerto_pessoas_pct, acerto_custo_pct, observacoes, fechado_por)
  VALUES
    (_ordem_id, v_data, _pessoas_reais, _faturamento_real, v_ticket_real,
     v_custo_real, v_cmv_real_pct, v_sobras_total,
     v_acerto_pessoas, v_acerto_custo, _observacoes, auth.uid())
  ON CONFLICT (ordem_id) DO UPDATE
    SET pessoas_reais = EXCLUDED.pessoas_reais,
        faturamento_real = EXCLUDED.faturamento_real,
        ticket_real = EXCLUDED.ticket_real,
        custo_real = EXCLUDED.custo_real,
        cmv_real_pct = EXCLUDED.cmv_real_pct,
        sobras_total_kg = EXCLUDED.sobras_total_kg,
        acerto_pessoas_pct = EXCLUDED.acerto_pessoas_pct,
        acerto_custo_pct = EXCLUDED.acerto_custo_pct,
        observacoes = EXCLUDED.observacoes,
        fechado_por = EXCLUDED.fechado_por
  RETURNING id INTO v_fechamento_id;

  RETURN v_fechamento_id;
END;
$$;