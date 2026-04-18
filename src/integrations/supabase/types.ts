export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cardapio: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          ficha_id: string
          id: string
          observacoes: string | null
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          ficha_id: string
          id?: string
          observacoes?: string | null
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          ficha_id?: string
          id?: string
          observacoes?: string | null
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "cardapio_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_dia: {
        Row: {
          acerto_custo_pct: number | null
          acerto_pessoas_pct: number | null
          cmv_real_pct: number | null
          created_at: string
          custo_real: number
          data_operacao: string
          faturamento_real: number
          fechado_por: string | null
          id: string
          observacoes: string | null
          ordem_id: string
          pessoas_reais: number
          sobras_total_kg: number | null
          ticket_real: number | null
        }
        Insert: {
          acerto_custo_pct?: number | null
          acerto_pessoas_pct?: number | null
          cmv_real_pct?: number | null
          created_at?: string
          custo_real?: number
          data_operacao: string
          faturamento_real: number
          fechado_por?: string | null
          id?: string
          observacoes?: string | null
          ordem_id: string
          pessoas_reais: number
          sobras_total_kg?: number | null
          ticket_real?: number | null
        }
        Update: {
          acerto_custo_pct?: number | null
          acerto_pessoas_pct?: number | null
          cmv_real_pct?: number | null
          created_at?: string
          custo_real?: number
          data_operacao?: string
          faturamento_real?: number
          fechado_por?: string | null
          id?: string
          observacoes?: string | null
          ordem_id?: string
          pessoas_reais?: number
          sobras_total_kg?: number | null
          ticket_real?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_dia_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: true
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_itens: {
        Row: {
          created_at: string
          custo_item: number
          ficha_id: string
          id: string
          insumo_id: string
          observacoes: string | null
          quantidade: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Insert: {
          created_at?: string
          custo_item?: number
          ficha_id: string
          id?: string
          insumo_id: string
          observacoes?: string | null
          quantidade: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Update: {
          created_at?: string
          custo_item?: number
          ficha_id?: string
          id?: string
          insumo_id?: string
          observacoes?: string | null
          quantidade?: number
          unidade?: Database["public"]["Enums"]["unidade_medida"]
        }
        Relationships: [
          {
            foreignKeyName: "ficha_itens_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_alertas_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas_tecnicas: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["categoria_ficha"]
          cmv_calculado: number
          cmv_por_porcao: number
          created_at: string
          id: string
          modo_preparo: string | null
          nome: string
          observacoes: string | null
          preco_venda: number | null
          rendimento_porcoes: number
          tempo_preparo_min: number | null
          unidade_rendimento: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["categoria_ficha"]
          cmv_calculado?: number
          cmv_por_porcao?: number
          created_at?: string
          id?: string
          modo_preparo?: string | null
          nome: string
          observacoes?: string | null
          preco_venda?: number | null
          rendimento_porcoes?: number
          tempo_preparo_min?: number | null
          unidade_rendimento?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_ficha"]
          cmv_calculado?: number
          cmv_por_porcao?: number
          created_at?: string
          id?: string
          modo_preparo?: string | null
          nome?: string
          observacoes?: string | null
          preco_venda?: number | null
          rendimento_porcoes?: number
          tempo_preparo_min?: number | null
          unidade_rendimento?: string
          updated_at?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          contato: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          custo_medio: number
          estoque_atual: number
          fornecedor_id: string | null
          id: string
          nome: string
          observacoes: string | null
          ponto_reposicao: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_medio?: number
          estoque_atual?: number
          fornecedor_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          ponto_reposicao?: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_medio?: number
          estoque_atual?: number
          fornecedor_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          ponto_reposicao?: number
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_estoque: {
        Row: {
          created_at: string
          custo_total: number
          custo_unitario: number
          data_movimento: string
          documento: string | null
          fornecedor_id: string | null
          id: string
          insumo_id: string
          observacoes: string | null
          ordem_producao_id: string | null
          quantidade: number
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento"]
        }
        Insert: {
          created_at?: string
          custo_total?: number
          custo_unitario?: number
          data_movimento?: string
          documento?: string | null
          fornecedor_id?: string | null
          id?: string
          insumo_id: string
          observacoes?: string | null
          ordem_producao_id?: string | null
          quantidade: number
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento"]
        }
        Update: {
          created_at?: string
          custo_total?: number
          custo_unitario?: number
          data_movimento?: string
          documento?: string | null
          fornecedor_id?: string | null
          id?: string
          insumo_id?: string
          observacoes?: string | null
          ordem_producao_id?: string | null
          quantidade?: number
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_estoque_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_alertas_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_itens: {
        Row: {
          created_at: string
          custo_previsto: number
          ficha_id: string
          id: string
          observacoes: string | null
          ordem_id: string
          porcoes_consumidas: number | null
          porcoes_previstas: number
          porcoes_produzidas: number | null
          sobras: number | null
        }
        Insert: {
          created_at?: string
          custo_previsto?: number
          ficha_id: string
          id?: string
          observacoes?: string | null
          ordem_id: string
          porcoes_consumidas?: number | null
          porcoes_previstas?: number
          porcoes_produzidas?: number | null
          sobras?: number | null
        }
        Update: {
          created_at?: string
          custo_previsto?: number
          ficha_id?: string
          id?: string
          observacoes?: string | null
          ordem_id?: string
          porcoes_consumidas?: number | null
          porcoes_previstas?: number
          porcoes_produzidas?: number | null
          sobras?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordem_itens_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_itens_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_producao: {
        Row: {
          cmv_previsto_pct: number | null
          cmv_real_pct: number | null
          created_at: string
          criado_por: string | null
          custo_previsto: number
          custo_real: number | null
          data_operacao: string
          faturamento_real: number | null
          id: string
          observacoes: string | null
          origem: string
          pessoas_esperadas: number
          pessoas_reais: number | null
          status: Database["public"]["Enums"]["status_ordem"]
          ticket_medio: number
          updated_at: string
        }
        Insert: {
          cmv_previsto_pct?: number | null
          cmv_real_pct?: number | null
          created_at?: string
          criado_por?: string | null
          custo_previsto?: number
          custo_real?: number | null
          data_operacao?: string
          faturamento_real?: number | null
          id?: string
          observacoes?: string | null
          origem?: string
          pessoas_esperadas?: number
          pessoas_reais?: number | null
          status?: Database["public"]["Enums"]["status_ordem"]
          ticket_medio?: number
          updated_at?: string
        }
        Update: {
          cmv_previsto_pct?: number | null
          cmv_real_pct?: number | null
          created_at?: string
          criado_por?: string | null
          custo_previsto?: number
          custo_real?: number | null
          data_operacao?: string
          faturamento_real?: number | null
          id?: string
          observacoes?: string | null
          origem?: string
          pessoas_esperadas?: number
          pessoas_reais?: number | null
          status?: Database["public"]["Enums"]["status_ordem"]
          ticket_medio?: number
          updated_at?: string
        }
        Relationships: []
      }
      parametros_demanda: {
        Row: {
          ativo: boolean
          created_at: string
          ficha_id: string
          id: string
          peso_dia_semana: number
          porcoes_por_pessoa: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          ficha_id: string
          id?: string
          peso_dia_semana?: number
          porcoes_por_pessoa?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          ficha_id?: string
          id?: string
          peso_dia_semana?: number
          porcoes_por_pessoa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_demanda_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: true
            referencedRelation: "fichas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          expira_em: string | null
          id: string
          nome: string
          token_hash: string
          token_prefix: string
          total_chamadas: number
          ultimo_uso: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          nome: string
          token_hash: string
          token_prefix: string
          total_chamadas?: number
          ultimo_uso?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          nome?: string
          token_hash?: string
          token_prefix?: string
          total_chamadas?: number
          ultimo_uso?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_alertas_estoque: {
        Row: {
          custo_medio: number | null
          estoque_atual: number | null
          fornecedor_nome: string | null
          id: string | null
          nivel: string | null
          nome: string | null
          ponto_reposicao: number | null
          unidade: Database["public"]["Enums"]["unidade_medida"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      criar_ordem_via_webhook: {
        Args: {
          _data: string
          _origem?: string
          _pessoas: number
          _ticket?: number
        }
        Returns: string
      }
      fechar_ordem_producao: {
        Args: {
          _faturamento_real: number
          _itens_reais: Json
          _observacoes?: string
          _ordem_id: string
          _pessoas_reais: number
        }
        Returns: string
      }
      gerar_ordem_producao: {
        Args: {
          _data: string
          _origem?: string
          _pessoas: number
          _ticket?: number
        }
        Returns: string
      }
      gerar_token_webhook: {
        Args: { _expira_em?: string; _nome: string }
        Returns: Json
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validar_token_webhook: { Args: { _token: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "gerente" | "cozinha" | "estoque"
      categoria_ficha: "pizza" | "cozinha" | "sobremesa" | "bebida" | "salgado"
      status_ordem:
        | "rascunho"
        | "confirmada"
        | "em_producao"
        | "concluida"
        | "cancelada"
      tipo_movimento:
        | "entrada_compra"
        | "saida_producao"
        | "ajuste_inventario"
        | "perda"
        | "transferencia"
      unidade_medida: "kg" | "g" | "l" | "ml" | "un" | "pct" | "cx" | "dz"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente", "cozinha", "estoque"],
      categoria_ficha: ["pizza", "cozinha", "sobremesa", "bebida", "salgado"],
      status_ordem: [
        "rascunho",
        "confirmada",
        "em_producao",
        "concluida",
        "cancelada",
      ],
      tipo_movimento: [
        "entrada_compra",
        "saida_producao",
        "ajuste_inventario",
        "perda",
        "transferencia",
      ],
      unidade_medida: ["kg", "g", "l", "ml", "un", "pct", "cx", "dz"],
    },
  },
} as const
