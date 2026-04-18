-- =========================================================
-- FASE 2: Estoque Inteligente + Motor de Produção
-- =========================================================

-- ENUM: tipo de movimentação de estoque
CREATE TYPE public.tipo_movimento AS ENUM (
  'entrada_compra',
  'saida_producao',
  'ajuste_inventario',
  'perda',
  'transferencia'
);

-- ENUM: status da ordem de produção
CREATE TYPE public.status_ordem AS ENUM (
  'rascunho',
  'confirmada',
  'em_producao',
  'concluida',
  'cancelada'
);

-- =========================================================
-- TABELA: movimentos_estoque
-- =========================================================
CREATE TABLE public.movimentos_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  tipo public.tipo_movimento NOT NULL,
  quantidade NUMERIC(12,4) NOT NULL,
  custo_unitario NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_total NUMERIC(12,4) NOT NULL DEFAULT 0,
  data_movimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ordem_producao_id UUID,
  documento TEXT,
  observacoes TEXT,
  registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_insumo_data ON public.movimentos_estoque(insumo_id, data_movimento DESC);
CREATE INDEX idx_mov_tipo ON public.movimentos_estoque(tipo);

ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_select_all" ON public.movimentos_estoque
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mov_write" ON public.movimentos_estoque
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'estoque')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'estoque')
  );

-- =========================================================
-- FUNCAO: aplicar movimento ao estoque do insumo
-- (atualiza estoque_atual e custo_medio ponderado em entradas)
-- =========================================================
CREATE OR REPLACE FUNCTION public.aplicar_movimento_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estoque_atual NUMERIC(12,4);
  v_custo_atual NUMERIC(12,4);
  v_delta NUMERIC(12,4);
  v_novo_estoque NUMERIC(12,4);
  v_novo_custo NUMERIC(12,4);
BEGIN
  -- garante custo_total
  IF NEW.custo_total = 0 AND NEW.custo_unitario > 0 THEN
    NEW.custo_total := NEW.custo_unitario * NEW.quantidade;
  END IF;

  SELECT estoque_atual, custo_medio
    INTO v_estoque_atual, v_custo_atual
    FROM public.insumos WHERE id = NEW.insumo_id FOR UPDATE;

  -- entrada soma, demais reduzem (quantidade sempre positiva)
  IF NEW.tipo = 'entrada_compra' THEN
    v_delta := NEW.quantidade;
  ELSIF NEW.tipo = 'ajuste_inventario' THEN
    -- ajuste: quantidade pode ser negativa (passada como negativa)
    v_delta := NEW.quantidade;
  ELSE
    v_delta := -ABS(NEW.quantidade);
  END IF;

  v_novo_estoque := COALESCE(v_estoque_atual,0) + v_delta;

  -- Custo médio ponderado apenas em entradas com custo > 0
  IF NEW.tipo = 'entrada_compra' AND NEW.custo_unitario > 0 AND v_novo_estoque > 0 THEN
    v_novo_custo := (
      (COALESCE(v_estoque_atual,0) * COALESCE(v_custo_atual,0)) +
      (NEW.quantidade * NEW.custo_unitario)
    ) / v_novo_estoque;
  ELSE
    v_novo_custo := v_custo_atual;
  END IF;

  UPDATE public.insumos
    SET estoque_atual = v_novo_estoque,
        custo_medio = COALESCE(v_novo_custo, custo_medio),
        updated_at = now()
    WHERE id = NEW.insumo_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aplicar_movimento
  BEFORE INSERT ON public.movimentos_estoque
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimento_estoque();

-- =========================================================
-- TABELA: ordens_producao (motor de demanda → produção)
-- =========================================================
CREATE TABLE public.ordens_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_operacao DATE NOT NULL DEFAULT CURRENT_DATE,
  pessoas_esperadas INTEGER NOT NULL DEFAULT 0,
  pessoas_reais INTEGER,
  ticket_medio NUMERIC(10,2) NOT NULL DEFAULT 89.90,
  faturamento_real NUMERIC(12,2),
  origem TEXT NOT NULL DEFAULT 'manual', -- manual | webhook_n8n
  status public.status_ordem NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  custo_previsto NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_real NUMERIC(12,2),
  cmv_previsto_pct NUMERIC(6,3),
  cmv_real_pct NUMERIC(6,3),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ordens_data ON public.ordens_producao(data_operacao DESC);

ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordens_select_all" ON public.ordens_producao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ordens_write" ON public.ordens_producao
  FOR ALL TO authenticated
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

CREATE TRIGGER trg_ordens_updated_at
  BEFORE UPDATE ON public.ordens_producao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- TABELA: ordem_itens (cada ficha técnica a produzir no dia)
-- =========================================================
CREATE TABLE public.ordem_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  ficha_id UUID NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE RESTRICT,
  porcoes_previstas NUMERIC(10,2) NOT NULL DEFAULT 0,
  porcoes_produzidas NUMERIC(10,2),
  porcoes_consumidas NUMERIC(10,2),
  sobras NUMERIC(10,2),
  custo_previsto NUMERIC(12,4) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ordem_itens_ordem ON public.ordem_itens(ordem_id);

ALTER TABLE public.ordem_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordem_itens_select_all" ON public.ordem_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ordem_itens_write" ON public.ordem_itens
  FOR ALL TO authenticated
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

-- =========================================================
-- TABELA: parametros_demanda (mix do buffet por categoria)
-- ex.: 1 pessoa consome 0.18 pizza, 0.25 porção lasanha, etc
-- =========================================================
CREATE TABLE public.parametros_demanda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id UUID NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE CASCADE,
  porcoes_por_pessoa NUMERIC(8,4) NOT NULL DEFAULT 0,
  peso_dia_semana NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ficha_id)
);

ALTER TABLE public.parametros_demanda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "param_select_all" ON public.parametros_demanda
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "param_write" ON public.parametros_demanda
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE TRIGGER trg_param_updated_at
  BEFORE UPDATE ON public.parametros_demanda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- FUNCAO: gerar ordem de produção a partir de demanda
-- Calcula porções por ficha (pessoas × porcoes_por_pessoa × peso_dia)
-- e custo previsto baseado em cmv_por_porcao.
-- =========================================================
CREATE OR REPLACE FUNCTION public.gerar_ordem_producao(
  _data DATE,
  _pessoas INTEGER,
  _ticket NUMERIC DEFAULT 89.90,
  _origem TEXT DEFAULT 'manual'
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
    (data_operacao, pessoas_esperadas, ticket_medio, origem, status, criado_por)
  VALUES (_data, _pessoas, _ticket, _origem, 'confirmada', auth.uid())
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

-- =========================================================
-- VIEW: alertas de estoque (ruptura / abaixo do ponto)
-- =========================================================
CREATE OR REPLACE VIEW public.v_alertas_estoque AS
SELECT
  i.id,
  i.nome,
  i.unidade,
  i.estoque_atual,
  i.ponto_reposicao,
  i.custo_medio,
  CASE
    WHEN i.estoque_atual <= 0 THEN 'ruptura'
    WHEN i.estoque_atual <= i.ponto_reposicao THEN 'reposicao'
    ELSE 'ok'
  END AS nivel,
  f.nome AS fornecedor_nome
FROM public.insumos i
LEFT JOIN public.fornecedores f ON f.id = i.fornecedor_id
WHERE i.ativo = true;
