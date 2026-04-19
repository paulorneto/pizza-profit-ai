import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Bot, User2, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/consultor")({
  head: () => ({ meta: [{ title: "Consultor IA 360 — LLum" }] }),
  component: ConsultorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "E se vierem 300 pessoas no domingo? quanto preciso produzir?",
  "Simule a mussarela subindo 15% — qual ficha sofre mais?",
  "Meu estoque cobre 250 pessoas hoje?",
  "Como está meu CMV nos últimos fechamentos?",
  "Quais 3 fichas têm o pior CMV % e o que faço?",
];

function ConsultorPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function enviar(texto?: string) {
    const conteudo = (texto ?? input).trim();
    if (!conteudo || loading) return;
    setInput("");
    const novosMsgs: Msg[] = [...messages, { role: "user", content: conteudo }];
    setMessages(novosMsgs);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("consultor-ia", {
        body: { messages: novosMsgs },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.content ?? "Sem resposta.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar IA");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${e.message || "Erro"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        eyebrow="Fase 4 · Consultor IA 360"
        title="Consultor IA"
        description="Chat com acesso ao estoque, fichas, ordens e fechamentos. Faça perguntas, simule cenários e receba ações concretas."
      />

      <Card className="flex flex-1 flex-col overflow-hidden border-border/60 bg-gradient-surface">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl text-center pt-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-ember shadow-elegant">
                <Sparkles className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl text-foreground">
                Pergunte qualquer coisa sobre a operação
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ex: simulações de demanda, impacto de alta de insumo, projeção de CMV, cobertura de
                estoque.
              </p>
              <div className="mt-6 grid gap-2 text-left">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-card"
                  >
                    <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Consultor analisando dados...
            </div>
          )}
        </div>

        <div className="border-t border-border/60 bg-background/40 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Pergunte sobre demanda, custos, cenários... (Enter envia, Shift+Enter quebra linha)"
              className="min-h-[52px] max-h-40 resize-none bg-background/60"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-[52px] gap-2 bg-gradient-ember text-primary-foreground"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-accent/20 text-accent" : "bg-gradient-ember text-primary-foreground",
        )}
      >
        {isUser ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-accent/15 text-foreground"
            : "border border-border/60 bg-card/60 text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-table:text-xs prose-th:text-foreground prose-td:text-foreground/90 prose-code:text-primary prose-code:bg-muted/40 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
