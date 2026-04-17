-- =====================================================
-- LLum Pizzaria - Schema Fase 1: Fundação
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'cozinha', 'estoque');
CREATE TYPE public.unidade_medida AS ENUM ('kg', 'g', 'l', 'ml', 'un', 'pct', 'cx', 'dz');
CREATE TYPE public.categoria_ficha AS ENUM ('pizza', 'cozinha', 'sobremesa', 'bebida', 'salgado');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id $$;

CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade unidade_medida NOT NULL,
  custo_medio NUMERIC(12,4) NOT NULL DEFAULT 0,
  estoque_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
  ponto_reposicao NUMERIC(12,3) NOT NULL DEFAULT 0,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  categoria TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_insumos_nome ON public.insumos(nome);
CREATE INDEX idx_insumos_categoria ON public.insumos(categoria);

CREATE TABLE public.fichas_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria categoria_ficha NOT NULL,
  rendimento_porcoes NUMERIC(10,2) NOT NULL DEFAULT 1,
  unidade_rendimento TEXT NOT NULL DEFAULT 'porção',
  modo_preparo TEXT,
  tempo_preparo_min INTEGER,
  cmv_calculado NUMERIC(12,4) NOT NULL DEFAULT 0,
  cmv_por_porcao NUMERIC(12,4) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(12,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fichas_tecnicas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fichas_categoria ON public.fichas_tecnicas(categoria);

CREATE TABLE public.ficha_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id UUID NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,4) NOT NULL,
  unidade unidade_medida NOT NULL,
  custo_item NUMERIC(12,4) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ficha_itens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ficha_itens_ficha ON public.ficha_itens(ficha_id);

CREATE TABLE public.cardapio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id UUID NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cardapio ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cardapio_ativo ON public.cardapio(ativo, data_inicio);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_insumos_updated BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fichas_updated BEFORE UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email);
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'gerente');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.recalc_ficha_cmv()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_ficha_id UUID;
  v_total NUMERIC(12,4);
  v_rendimento NUMERIC(10,2);
BEGIN
  v_ficha_id := COALESCE(NEW.ficha_id, OLD.ficha_id);
  SELECT COALESCE(SUM(custo_item), 0) INTO v_total FROM public.ficha_itens WHERE ficha_id = v_ficha_id;
  SELECT rendimento_porcoes INTO v_rendimento FROM public.fichas_tecnicas WHERE id = v_ficha_id;
  UPDATE public.fichas_tecnicas
    SET cmv_calculado = v_total,
        cmv_por_porcao = CASE WHEN v_rendimento > 0 THEN v_total / v_rendimento ELSE 0 END,
        updated_at = now()
    WHERE id = v_ficha_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_recalc_cmv AFTER INSERT OR UPDATE OR DELETE ON public.ficha_itens FOR EACH ROW EXECUTE FUNCTION public.recalc_ficha_cmv();

-- RLS POLICIES
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fornecedores_select_all" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "fornecedores_write" ON public.fornecedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'estoque'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'estoque'));

CREATE POLICY "insumos_select_all" ON public.insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "insumos_write" ON public.insumos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'estoque'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'estoque'));

CREATE POLICY "fichas_select_all" ON public.fichas_tecnicas FOR SELECT TO authenticated USING (true);
CREATE POLICY "fichas_write" ON public.fichas_tecnicas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "ficha_itens_select_all" ON public.ficha_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "ficha_itens_write" ON public.ficha_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "cardapio_select_all" ON public.cardapio FOR SELECT TO authenticated USING (true);
CREATE POLICY "cardapio_write" ON public.cardapio FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));