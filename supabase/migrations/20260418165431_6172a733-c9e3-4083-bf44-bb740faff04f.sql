DROP VIEW IF EXISTS public.v_alertas_estoque;

CREATE VIEW public.v_alertas_estoque
WITH (security_invoker = on) AS
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