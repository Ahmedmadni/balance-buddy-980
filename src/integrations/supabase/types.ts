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
      asset_market_values: {
        Row: {
          created_at: string
          currency: string
          id: string
          investment_id: string
          market_value: number
          notes: string | null
          source: string | null
          updated_at: string
          user_id: string
          valuation_date: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          investment_id: string
          market_value: number
          notes?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
          valuation_date?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          investment_id?: string
          market_value?: number
          notes?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
          valuation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_market_values_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          id: string
          kind: string | null
          mime_type: string | null
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          id?: string
          kind?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          id?: string
          kind?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["contact_kind"]
          name: string
          notes: string | null
          phone: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contact_kind"]
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contact_kind"]
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          id: string
          notes: string | null
          paid_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          contact_id: string | null
          contact_name: string
          created_at: string
          currency: string
          direction: string
          due_date: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          contact_id?: string | null
          contact_name: string
          created_at?: string
          currency?: string
          direction: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          currency?: string
          direction?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciation_profiles: {
        Row: {
          created_at: string
          id: string
          investment_id: string
          is_active: boolean
          method: string
          notes: string | null
          salvage_value: number
          start_date: string
          units_consumed: number | null
          units_total: number | null
          updated_at: string
          useful_life_months: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investment_id: string
          is_active?: boolean
          method?: string
          notes?: string | null
          salvage_value?: number
          start_date?: string
          units_consumed?: number | null
          units_total?: number | null
          updated_at?: string
          useful_life_months: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investment_id?: string
          is_active?: boolean
          method?: string
          notes?: string | null
          salvage_value?: number
          start_date?: string
          units_consumed?: number | null
          units_total?: number | null
          updated_at?: string
          useful_life_months?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_profiles_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          currency: string
          id: string
          rate_to_base: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          currency: string
          id?: string
          rate_to_base: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          currency?: string
          id?: string
          rate_to_base?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_allocations: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expense_id: string
          id: string
          period: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expense_id: string
          id?: string
          period: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expense_id?: string
          id?: string
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          allocation_kind: string
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          id: string
          note: string | null
          project_id: string | null
          spent_at: string
          spread_months: number | null
          spread_start: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          allocation_kind?: string
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          project_id?: string | null
          spent_at?: string
          spread_months?: number | null
          spread_start?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          allocation_kind?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          project_id?: string | null
          spent_at?: string
          spread_months?: number | null
          spread_start?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_transactions: {
        Row: {
          affects_wallet: boolean
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          happened_at: string
          id: string
          investment_id: string
          kind: string
          notes: string | null
          tx_class: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          affects_wallet?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          happened_at?: string
          id?: string
          investment_id: string
          kind: string
          notes?: string | null
          tx_class?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          affects_wallet?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          happened_at?: string
          id?: string
          investment_id?: string
          kind?: string
          notes?: string | null
          tx_class?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_transactions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          acquired_at: string | null
          asset_kind: string | null
          base_value: number | null
          created_at: string
          currency: string
          current_value: number
          id: string
          is_zakatable: boolean
          meta: Json
          name: string
          nisab_reached_at: string | null
          notes: string | null
          ownership_pct: number
          parent_investment_id: string | null
          principal: number
          purpose: string | null
          realized_pnl: number | null
          sold_amount: number | null
          sold_at: string | null
          start_date: string
          status: string
          subtype: string | null
          type: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          acquired_at?: string | null
          asset_kind?: string | null
          base_value?: number | null
          created_at?: string
          currency?: string
          current_value?: number
          id?: string
          is_zakatable?: boolean
          meta?: Json
          name: string
          nisab_reached_at?: string | null
          notes?: string | null
          ownership_pct?: number
          parent_investment_id?: string | null
          principal?: number
          purpose?: string | null
          realized_pnl?: number | null
          sold_amount?: number | null
          sold_at?: string | null
          start_date?: string
          status?: string
          subtype?: string | null
          type?: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          acquired_at?: string | null
          asset_kind?: string | null
          base_value?: number | null
          created_at?: string
          currency?: string
          current_value?: number
          id?: string
          is_zakatable?: boolean
          meta?: Json
          name?: string
          nisab_reached_at?: string | null
          notes?: string | null
          ownership_pct?: number
          parent_investment_id?: string | null
          principal?: number
          purpose?: string | null
          realized_pnl?: number | null
          sold_amount?: number | null
          sold_at?: string | null
          start_date?: string
          status?: string
          subtype?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_parent_investment_id_fkey"
            columns: ["parent_investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      person_ledger: {
        Row: {
          amount: number
          contact_id: string | null
          contact_name: string
          created_at: string
          currency: string
          due_date: string | null
          happened_at: string
          id: string
          kind: string
          notes: string | null
          reminder_enabled: boolean
          settled_at: string | null
          status: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          contact_id?: string | null
          contact_name: string
          created_at?: string
          currency?: string
          due_date?: string | null
          happened_at?: string
          id?: string
          kind: string
          notes?: string | null
          reminder_enabled?: boolean
          settled_at?: string | null
          status?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          happened_at?: string
          id?: string
          kind?: string
          notes?: string | null
          reminder_enabled?: boolean
          settled_at?: string | null
          status?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_ledger_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          color: string | null
          created_at: string
          currency: string
          description: string | null
          icon: string | null
          id: string
          name: string
          status: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          status?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          auto_post: boolean
          category_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          end_date: string | null
          frequency: string
          id: string
          interval_count: number
          is_active: boolean
          last_posted_at: string | null
          name: string
          next_due: string
          notes: string | null
          project_id: string | null
          start_date: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          auto_post?: boolean
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          last_posted_at?: string | null
          name: string
          next_due: string
          notes?: string | null
          project_id?: string | null
          start_date: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          auto_post?: boolean
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          last_posted_at?: string | null
          name?: string
          next_due?: string
          notes?: string | null
          project_id?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      system_events: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          affects_balance: boolean
          amount: number
          category_id: string | null
          category_kind: string | null
          counterparty_account_id: string | null
          created_at: string
          currency: string
          description: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          happened_at: string
          id: string
          meta: Json
          notes: string | null
          person_id: string | null
          person_name: string | null
          source_id: string
          source_kind: string
          transfer_group_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          affects_balance?: boolean
          amount: number
          category_id?: string | null
          category_kind?: string | null
          counterparty_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          happened_at?: string
          id?: string
          meta?: Json
          notes?: string | null
          person_id?: string | null
          person_name?: string | null
          source_id: string
          source_kind: string
          transfer_group_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          affects_balance?: boolean
          amount?: number
          category_id?: string | null
          category_kind?: string | null
          counterparty_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["txn_direction"]
          happened_at?: string
          id?: string
          meta?: Json
          notes?: string | null
          person_id?: string | null
          person_name?: string | null
          source_id?: string
          source_kind?: string
          transfer_group_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counterparty_account_id_fkey"
            columns: ["counterparty_account_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          category_id: string | null
          contact_id: string | null
          counterparty_wallet_id: string | null
          created_at: string
          currency: string
          happened_at: string
          id: string
          kind: string
          notes: string | null
          source_id: string | null
          source_kind: string | null
          transfer_group_id: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          contact_id?: string | null
          counterparty_wallet_id?: string | null
          created_at?: string
          currency?: string
          happened_at?: string
          id?: string
          kind: string
          notes?: string | null
          source_id?: string | null
          source_kind?: string | null
          transfer_group_id?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          contact_id?: string | null
          counterparty_wallet_id?: string | null
          created_at?: string
          currency?: string
          happened_at?: string
          id?: string
          kind?: string
          notes?: string | null
          source_id?: string | null
          source_kind?: string | null
          transfer_group_id?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wallet_tx_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_counterparty_wallet_id_fkey"
            columns: ["counterparty_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_tx_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          kind: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          color: string | null
          created_at: string
          currency: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          opening_balance: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          currency?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          opening_balance?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          currency?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          opening_balance?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zakat_records: {
        Row: {
          base_amount: number
          base_currency: string | null
          breakdown: Json | null
          breakdown_json: Json | null
          calculated_at: string
          created_at: string
          currency: string
          haul_end: string | null
          haul_start: string | null
          hijri_year: string | null
          id: string
          nisab_value: number | null
          notes: string | null
          paid: boolean
          paid_at: string | null
          rate: number
          total_cash: number | null
          total_gold: number | null
          total_investments: number | null
          total_stocks: number | null
          total_trade: number | null
          updated_at: string
          user_id: string
          zakat_amount: number
        }
        Insert: {
          base_amount: number
          base_currency?: string | null
          breakdown?: Json | null
          breakdown_json?: Json | null
          calculated_at?: string
          created_at?: string
          currency?: string
          haul_end?: string | null
          haul_start?: string | null
          hijri_year?: string | null
          id?: string
          nisab_value?: number | null
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          rate?: number
          total_cash?: number | null
          total_gold?: number | null
          total_investments?: number | null
          total_stocks?: number | null
          total_trade?: number | null
          updated_at?: string
          user_id: string
          zakat_amount: number
        }
        Update: {
          base_amount?: number
          base_currency?: string | null
          breakdown?: Json | null
          breakdown_json?: Json | null
          calculated_at?: string
          created_at?: string
          currency?: string
          haul_end?: string | null
          haul_start?: string | null
          hijri_year?: string | null
          id?: string
          nisab_value?: number | null
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          rate?: number
          total_cash?: number | null
          total_gold?: number | null
          total_investments?: number | null
          total_stocks?: number | null
          total_trade?: number | null
          updated_at?: string
          user_id?: string
          zakat_amount?: number
        }
        Relationships: []
      }
      zakat_settings: {
        Row: {
          annual_date_type: string
          annual_date_value: string
          base_currency: string
          created_at: string
          first_nisab_reached_at: string | null
          gold_gram_price: number | null
          gold_jewelry_opinion: string
          id: string
          last_haul_start_date: string | null
          nisab_gold_grams: number
          nisab_method: string
          nisab_silver_grams: number
          silver_gram_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_date_type?: string
          annual_date_value?: string
          base_currency?: string
          created_at?: string
          first_nisab_reached_at?: string | null
          gold_gram_price?: number | null
          gold_jewelry_opinion?: string
          id?: string
          last_haul_start_date?: string | null
          nisab_gold_grams?: number
          nisab_method?: string
          nisab_silver_grams?: number
          silver_gram_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_date_type?: string
          annual_date_value?: string
          base_currency?: string
          created_at?: string
          first_nisab_reached_at?: string | null
          gold_gram_price?: number | null
          gold_jewelry_opinion?: string
          id?: string
          last_haul_start_date?: string | null
          nisab_gold_grams?: number
          nisab_method?: string
          nisab_silver_grams?: number
          silver_gram_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_account_statement: {
        Row: {
          account_id: string | null
          amount: number | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          direction: Database["public"]["Enums"]["txn_direction"] | null
          happened_at: string | null
          id: string | null
          person_name: string | null
          running_balance: number | null
          signed_amount: number | null
          source_kind: string | null
          type: Database["public"]["Enums"]["txn_type"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _wallet_kind_dir: {
        Args: { _kind: string }
        Returns: Database["public"]["Enums"]["txn_direction"]
      }
      _wallet_kind_type: {
        Args: { _kind: string }
        Returns: Database["public"]["Enums"]["txn_type"]
      }
    }
    Enums: {
      contact_kind:
        | "individual"
        | "spouse"
        | "relative"
        | "friend"
        | "employee"
        | "client"
        | "supplier"
      txn_direction: "in" | "out" | "neutral"
      txn_type:
        | "expense"
        | "income"
        | "transfer"
        | "debt"
        | "investment"
        | "adjustment"
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
      contact_kind: [
        "individual",
        "spouse",
        "relative",
        "friend",
        "employee",
        "client",
        "supplier",
      ],
      txn_direction: ["in", "out", "neutral"],
      txn_type: [
        "expense",
        "income",
        "transfer",
        "debt",
        "investment",
        "adjustment",
      ],
    },
  },
} as const
