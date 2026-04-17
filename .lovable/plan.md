
# LLum Pizzaria — Sistema 360 com IA para Otimização de Recursos

Plataforma completa de gestão operacional para pizzaria de buffet, com motor de previsão de produção baseado em demanda, controle de CMV em tempo real e consultor de IA cruzando todos os dados.

## 🎯 Visão geral

O sistema transforma 3 entradas (fichas técnicas + estoque + demanda do dia) em saídas acionáveis: ordem de produção da cozinha, previsão de consumo de insumos, CMV por prato, KPIs do dia e respostas inteligentes via IA.

## 👥 Acessos (multi-perfil)

- **Sócio/Admin** — vê e edita tudo, dashboards financeiros, IA completa
- **Gerente** — operacional + relatórios, sem precificação sensível
- **Cozinha** — recebe a "Ordem de Produção do Dia" (o que e quanto produzir)
- **Pizzaiolo** — ordem de pizzas previstas por sabor + consumo de massa/molho
- **Compras/Estoque** — alertas de reposição, entradas de notas

## 🧱 Módulos do sistema

### 1. Cadastros base
- **Insumos** (mussarela, farinha, arroz, óleo, etc.) com unidade, custo médio, fornecedor, ponto de reposição
- **Fichas técnicas — Pizza**: cada sabor com insumos, gramaturas, rendimento, CMV calculado automaticamente
- **Fichas técnicas — Cozinha/Buffet**: lasanha, arroz, feijão, salgados fritos, sobremesas — cada prato com rendimento (ex: 1 lasanha = 12 porções) e CMV por porção
- **Cardápio do buffet** ativo do dia (o que vai pra rampa)

### 2. Estoque inteligente
- Entradas (compras com nota), saídas automáticas via produção
- Saldo em tempo real, custo médio ponderado
- Alertas de ruptura e validade
- Inventário rápido (contagem semanal)

### 3. Motor de Demanda → Produção (o coração do sistema)
**Entrada**: nº de pessoas esperadas no dia (manual OU webhook do n8n)

**Saída automática**:
- Quantas lasanhas assar, kg de arroz cozinhar, pacotes de salgados fritar
- Quantas pizzas por sabor (top sabores históricos × demanda)
- Lista de insumos a separar (mise en place)
- Custo previsto da operação do dia

A IA aprende padrões: dia da semana, clima, feriados, eventos locais → ajusta a sugestão (ex: "quinta chuvosa = -15% no buffet, +8% pizza")

### 4. Webhook n8n
Endpoint público autenticado que recebe payload do tipo:
```
{ "data": "2025-04-17", "pessoas_esperadas": 320, "origem": "grupo_whatsapp" }
```
e dispara automaticamente o cálculo de produção.

### 5. Fechamento do dia (Real x Previsto)
- Quantas pessoas vieram de fato, faturamento real
- Sobras (pesar/contar) e desperdício
- Sistema calcula CMV real do dia, margem do buffet, acerto da previsão
- Alimenta o aprendizado da IA pra próximas previsões

### 6. KPIs e Relatórios
- **Operacionais**: cobertura de buffet, custo por pessoa, % desperdício, acerto de previsão
- **Financeiros**: CMV total, CMV por categoria (pizza/cozinha/sobremesa), margem por dia, ranking de pratos mais caros vs. mais consumidos
- **Cozinha**: produtividade, sobras recorrentes (gatilho pra ajustar receita)
- **Estoque**: giro, ruptura, valor parado

### 7. Consultor IA (chat 360)
Chat que cruza TODAS as bases e responde perguntas como:
- "Qual foi meu custo operacional ontem?"
- "Qual pizza dá mais prejuízo no buffet?"
- "Quanto desperdiço de lasanha em média na quarta?"
- "Se eu subir o buffet pra R$99,90, qual minha nova margem assumindo mesmo CMV?"
- "Quais 3 ações me dariam mais economia esse mês?"
- **Simulações**: "E se eu trocar mussarela do fornecedor A pelo B (R$2/kg mais barato)?"

A IA faz **alertas proativos** no dashboard: "🚨 CMV da lasanha subiu 12% essa semana — provável aumento da carne moída", "💡 Recomendo produzir 22 lasanhas amanhã (sábado, sem chuva, padrão histórico)".

## 🎨 UX e identidade visual

- Tema escuro premium com toques quentes (vermelho/laranja sutis remetendo à pizzaria) ou claro elegante — a definir no build
- Dashboard principal com 4 cards-resumo (Hoje: pessoas previstas, custo previsto, CMV%, alertas IA)
- Mobile-first nos painéis da cozinha (tablet na rampa) e desktop nos painéis de gestão

## 🔧 Stack técnica

- **Frontend**: TanStack Start + React + Tailwind + shadcn/ui (gráficos com Recharts)
- **Backend**: Lovable Cloud (Postgres + Auth + Storage + Edge Functions)
- **IA**: Lovable AI Gateway (Gemini 3 Flash pro chat e cálculos; Gemini 2.5 Pro para simulações complexas)
- **Auth**: Email/senha com 4 roles (admin, gerente, cozinha, estoque) usando tabela `user_roles` separada + RLS
- **Webhook n8n**: server route `/api/webhook/demanda` com token de autenticação

## 🗺️ Roadmap de entrega (faseado)

Como é um escopo grande, vou entregar em **fases incrementais** pra você validar cada parte:

**Fase 1 — Fundação** (esta entrega)
- Auth + roles + estrutura do banco completa
- Cadastros: insumos, fichas técnicas (pizza e cozinha), cardápio
- Dashboard inicial e navegação dos 4 perfis

**Fase 2 — Estoque + Motor de Produção**
- Entradas/saídas, saldo, alertas
- Cálculo de demanda → ordem de produção
- Tela da cozinha (mise en place do dia)

**Fase 3 — Webhook n8n + Fechamento do Dia**
- Endpoint autenticado
- Real x Previsto, cálculo de CMV real, sobras

**Fase 4 — Consultor IA + Simulações + Relatórios avançados**
- Chat 360 com acesso a todas as bases
- Alertas proativos, simulações de cenário
- Relatórios exportáveis

Após aprovar, começo pela **Fase 1**.
