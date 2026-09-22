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
      admin_settings: {
        Row: {
          admin_pin_hash: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_pin_hash: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_pin_hash?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          operation: string
          order_id: string | null
          reason: string | null
          record_id: string | null
          record_type: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          operation: string
          order_id?: string | null
          reason?: string | null
          record_id?: string | null
          record_type: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          operation?: string
          order_id?: string | null
          reason?: string | null
          record_id?: string | null
          record_type?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          branch_name: string | null
          created_at: string
          details: string | null
          entity_id: string | null
          entity_name: string | null
          id: string
          ip_address: string | null
          module: string
          new_value: string | null
          old_value: string | null
          severity: string
          staff_id: string | null
          staff_name: string
          staff_role: string
          title: string
          user_id: string
        }
        Insert: {
          action: string
          branch_name?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          ip_address?: string | null
          module: string
          new_value?: string | null
          old_value?: string | null
          severity?: string
          staff_id?: string | null
          staff_name?: string
          staff_role?: string
          title: string
          user_id: string
        }
        Update: {
          action?: string
          branch_name?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          new_value?: string | null
          old_value?: string | null
          severity?: string
          staff_id?: string | null
          staff_name?: string
          staff_role?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      branch_extensions: {
        Row: {
          branch_id: string
          commercial_register: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          tax_number: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          commercial_register?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          tax_number?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          commercial_register?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          tax_number?: string | null
          user_id?: string
        }
        Relationships: []
      }
      branch_stock: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          max_stock: number | null
          min_stock: number
          quantity: number
          stock_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          max_stock?: number | null
          min_stock?: number
          quantity?: number
          stock_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          max_stock?: number | null
          min_stock?: number
          quantity?: number
          stock_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      branch_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          from_branch_id: string
          id: string
          items: Json
          notes: string | null
          status: string
          to_branch_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          from_branch_id: string
          id?: string
          items?: Json
          notes?: string | null
          status?: string
          to_branch_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          from_branch_id?: string
          id?: string
          items?: Json
          notes?: string | null
          status?: string
          to_branch_id?: string
          user_id?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          created_at: string | null
          id: string
          is_main: boolean | null
          location: string | null
          manager_name: string | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_main?: boolean | null
          location?: string | null
          manager_name?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_main?: boolean | null
          location?: string | null
          manager_name?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bundles: {
        Row: {
          bundle_price: number
          created_at: string
          id: string
          is_active: boolean
          items: Json
          name: string
          user_id: string
        }
        Insert: {
          bundle_price: number
          created_at?: string
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          user_id: string
        }
        Update: {
          bundle_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      carrier_settlements: {
        Row: {
          amount: number
          carrier_id: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          reference_number: string | null
          settled_on: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          carrier_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          reference_number?: string | null
          settled_on?: string
          type?: string
          user_id?: string
        }
        Update: {
          amount?: number
          carrier_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          reference_number?: string | null
          settled_on?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_settlements_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      category_budgets: {
        Row: {
          alert_threshold: number
          category: string
          created_at: string
          id: string
          monthly_budget: number
          user_id: string
        }
        Insert: {
          alert_threshold?: number
          category: string
          created_at?: string
          id?: string
          monthly_budget?: number
          user_id: string
        }
        Update: {
          alert_threshold?: number
          category?: string
          created_at?: string
          id?: string
          monthly_budget?: number
          user_id?: string
        }
        Relationships: []
      }
      collection_call_logs: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          outcome: string
          promise_date: string | null
          promised_amount: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          outcome: string
          promise_date?: string | null
          promised_amount?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          outcome?: string
          promise_date?: string | null
          promised_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_call_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_promises: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          promise_date: string
          promised_amount: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          promise_date: string
          promised_amount: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          promise_date?: string
          promised_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_promises_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number
          customer_type: string
          due_day: number
          frozen: boolean
          id: string
          joining_date: string
          name: string
          national_id: string | null
          notes: string | null
          opening_balance: number
          phone: string
          rating: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          due_day?: number
          frozen?: boolean
          id?: string
          joining_date?: string
          name: string
          national_id?: string | null
          notes?: string | null
          opening_balance?: number
          phone?: string
          rating?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          due_day?: number
          frozen?: boolean
          id?: string
          joining_date?: string
          name?: string
          national_id?: string | null
          notes?: string | null
          opening_balance?: number
          phone?: string
          rating?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          delivered_amount: number
          id: string
          next_attempt_at: string | null
          notes: string | null
          outcome: string
          reason: string | null
          shipment_id: string
          user_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          delivered_amount?: number
          id?: string
          next_attempt_at?: string | null
          notes?: string | null
          outcome?: string
          reason?: string | null
          shipment_id: string
          user_id?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          delivered_amount?: number
          id?: string
          next_attempt_at?: string | null
          notes?: string | null
          outcome?: string
          reason?: string | null
          shipment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_attempts_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_metadata: {
        Row: {
          account_id: string | null
          branch_id: string | null
          cost_center: string | null
          created_at: string
          custom_fields: Json | null
          expense_id: string
          id: string
          receipt_url: string | null
          user_id: string
          voucher_number: string | null
        }
        Insert: {
          account_id?: string | null
          branch_id?: string | null
          cost_center?: string | null
          created_at?: string
          custom_fields?: Json | null
          expense_id: string
          id?: string
          receipt_url?: string | null
          user_id: string
          voucher_number?: string | null
        }
        Update: {
          account_id?: string | null
          branch_id?: string | null
          cost_center?: string | null
          created_at?: string
          custom_fields?: Json | null
          expense_id?: string
          id?: string
          receipt_url?: string | null
          user_id?: string
          voucher_number?: string | null
        }
        Relationships: []
      }
      expense_settings: {
        Row: {
          created_at: string
          custom_categories: Json | null
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_categories?: Json | null
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_categories?: Json | null
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      held_invoices: {
        Row: {
          created_at: string
          data: Json
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          invoice_id: string
          paid_amount: number
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          invoice_id: string
          paid_amount?: number
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          invoice_id?: string
          paid_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_installments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          cost: number
          created_at: string
          discount_amount: number
          discount_pct: number
          id: string
          invoice_id: string
          line_total: number
          name: string
          price: number
          quantity: number
          serial_numbers: string[]
          tax_amount: number
          tax_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          id?: string
          invoice_id: string
          line_total?: number
          name: string
          price?: number
          quantity?: number
          serial_numbers?: string[]
          tax_amount?: number
          tax_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          id?: string
          invoice_id?: string
          line_total?: number
          name?: string
          price?: number
          quantity?: number
          serial_numbers?: string[]
          tax_amount?: number
          tax_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          date: string | null
          discount_amount: number
          discount_pct: number
          down_payment: number
          first_due_date: string | null
          id: string
          installment_count: number
          invoice_number: string | null
          last_installment_amount: number
          monthly_installment: number
          notes: string | null
          paid: number
          receipt_token: string
          status: string
          tax_amount: number
          tax_pct: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          date?: string | null
          discount_amount?: number
          discount_pct?: number
          down_payment?: number
          first_due_date?: string | null
          id?: string
          installment_count?: number
          invoice_number?: string | null
          last_installment_amount?: number
          monthly_installment?: number
          notes?: string | null
          paid?: number
          receipt_token?: string
          status?: string
          tax_amount?: number
          tax_pct?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          date?: string | null
          discount_amount?: number
          discount_pct?: number
          down_payment?: number
          first_due_date?: string | null
          id?: string
          installment_count?: number
          invoice_number?: string | null
          last_installment_amount?: number
          monthly_installment?: number
          notes?: string | null
          paid?: number
          receipt_token?: string
          status?: string
          tax_amount?: number
          tax_pct?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          billing_cycle: string
          client_name: string
          client_phone: string
          created_at: string
          currency: string
          device_fingerprint: string | null
          expiry_date: string
          hardware_included: string | null
          hardware_items: Json | null
          id: string
          installments: Json | null
          issue_date: string
          key: string
          last_active_date: string | null
          modules: Json
          notes: string | null
          paid_amount: number
          shop_address: string | null
          shop_name: string
          status: string
          support_logs: Json | null
          tax_number: string | null
          tax_rate_percent: number | null
          tier: string
          tier_label: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          currency?: string
          device_fingerprint?: string | null
          expiry_date?: string
          hardware_included?: string | null
          hardware_items?: Json | null
          id?: string
          installments?: Json | null
          issue_date?: string
          key: string
          last_active_date?: string | null
          modules?: Json
          notes?: string | null
          paid_amount?: number
          shop_address?: string | null
          shop_name?: string
          status?: string
          support_logs?: Json | null
          tax_number?: string | null
          tax_rate_percent?: number | null
          tier?: string
          tier_label?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          currency?: string
          device_fingerprint?: string | null
          expiry_date?: string
          hardware_included?: string | null
          hardware_items?: Json | null
          id?: string
          installments?: Json | null
          issue_date?: string
          key?: string
          last_active_date?: string | null
          modules?: Json
          notes?: string | null
          paid_amount?: number
          shop_address?: string | null
          shop_name?: string
          status?: string
          support_logs?: Json | null
          tax_number?: string | null
          tax_rate_percent?: number | null
          tier?: string
          tier_label?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          created_at: string
          earn_rate: number
          id: string
          is_active: boolean
          min_points_redeem: number
          redeem_rate: number
          user_id: string
        }
        Insert: {
          created_at?: string
          earn_rate?: number
          id?: string
          is_active?: boolean
          min_points_redeem?: number
          redeem_rate?: number
          user_id: string
        }
        Update: {
          created_at?: string
          earn_rate?: number
          id?: string
          is_active?: boolean
          min_points_redeem?: number
          redeem_rate?: number
          user_id?: string
        }
        Relationships: []
      }
      payment_vouchers: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          payment_method: string
          supplier_id: string | null
          type: string
          updated_at: string
          user_id: string
          voucher_date: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          payment_method: string
          supplier_id?: string | null
          type: string
          updated_at?: string
          user_id: string
          voucher_date?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          payment_method?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          voucher_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_vouchers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_vouchers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          paid_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          id?: string
          invoice_id: string
          paid_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          paid_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_coupons: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order: number
          type: string
          used_count: number
          user_id: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          type: string
          used_count?: number
          user_id: string
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          type?: string
          used_count?: number
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          name: string
          purchase_id: string
          quantity: number
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          purchase_id: string
          quantity?: number
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payment_type: string
          purchase_date: string
          supplier_id: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_type?: string
          purchase_date?: string
          supplier_id: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_type?: string
          purchase_date?: string
          supplier_id?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      qty_offers: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          is_active: boolean
          min_qty: number
          name: string
          stock_item_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_pct: number
          id?: string
          is_active?: boolean
          min_qty: number
          name: string
          stock_item_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          is_active?: boolean
          min_qty?: number
          name?: string
          stock_item_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reconciliation_audit_runs: {
        Row: {
          auto_fixable_count: number
          category_counts: Json
          created_at: string
          critical_count: number
          findings_count: number
          health_score: number
          id: string
          notice_count: number
          total_discrepancy: number
          trigger_source: string
          user_id: string
          warning_count: number
        }
        Insert: {
          auto_fixable_count?: number
          category_counts?: Json
          created_at?: string
          critical_count?: number
          findings_count?: number
          health_score?: number
          id?: string
          notice_count?: number
          total_discrepancy?: number
          trigger_source?: string
          user_id: string
          warning_count?: number
        }
        Update: {
          auto_fixable_count?: number
          category_counts?: Json
          created_at?: string
          critical_count?: number
          findings_count?: number
          health_score?: number
          id?: string
          notice_count?: number
          total_discrepancy?: number
          trigger_source?: string
          user_id?: string
          warning_count?: number
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          next_due_date: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          next_due_date: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          next_due_date?: string
          user_id?: string
        }
        Relationships: []
      }
      return_items: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          return_id: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          return_id: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          return_id?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_records"
            referencedColumns: ["id"]
          },
        ]
      }
      return_records: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          reason: string | null
          total_amount: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          total_amount?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          total_amount?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          branch_id: string | null
          card_sales: number
          closed_at: string | null
          closing_cash: number | null
          created_at: string
          denomination_count: Json | null
          expected_cash: number | null
          id: string
          installment_sales: number
          notes: string | null
          opened_at: string
          opening_float: number
          staff_id: string | null
          status: string
          total_discounts: number
          total_expenses: number
          total_refunds: number
          total_sales: number
          type: string
          user_id: string
          variance: number | null
        }
        Insert: {
          branch_id?: string | null
          card_sales?: number
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          denomination_count?: Json | null
          expected_cash?: number | null
          id?: string
          installment_sales?: number
          notes?: string | null
          opened_at?: string
          opening_float?: number
          staff_id?: string | null
          status?: string
          total_discounts?: number
          total_expenses?: number
          total_refunds?: number
          total_sales?: number
          type?: string
          user_id: string
          variance?: number | null
        }
        Update: {
          branch_id?: string | null
          card_sales?: number
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          denomination_count?: Json | null
          expected_cash?: number | null
          id?: string
          installment_sales?: number
          notes?: string | null
          opened_at?: string
          opening_float?: number
          staff_id?: string | null
          status?: string
          total_discounts?: number
          total_expenses?: number
          total_refunds?: number
          total_sales?: number
          type?: string
          user_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          expected_delivery_date: string | null
          id: string
          kind: string
          read_at: string | null
          resolved_at: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"] | null
          title: string
          tracking_identifier: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          expected_delivery_date?: string | null
          id?: string
          kind: string
          read_at?: string | null
          resolved_at?: string | null
          shipment_id: string
          status?: Database["public"]["Enums"]["shipment_status"] | null
          title: string
          tracking_identifier?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          expected_delivery_date?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          resolved_at?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"] | null
          title?: string
          tracking_identifier?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_notifications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_delivery_date: string | null
          carrier_id: string | null
          cod_amount: number
          collected_at: string | null
          collection_status: string
          created_at: string | null
          delivered_at: string | null
          delivery_address: string | null
          expected_delivery_date: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          pieces: number
          processing_at: string | null
          recipient_name: string | null
          recipient_phone: string | null
          returned_at: string | null
          settled_at: string | null
          shipped_at: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["shipment_status"] | null
          status_updated_by: string | null
          tracking_number: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number
          zone_id: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          carrier_id?: string | null
          cod_amount?: number
          collected_at?: string | null
          collection_status?: string
          created_at?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          pieces?: number
          processing_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          returned_at?: string | null
          settled_at?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["shipment_status"] | null
          status_updated_by?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
          zone_id?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          carrier_id?: string | null
          cod_amount?: number
          collected_at?: string | null
          collection_status?: string
          created_at?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          pieces?: number
          processing_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          returned_at?: string | null
          settled_at?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["shipment_status"] | null
          status_updated_by?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carriers: {
        Row: {
          active: boolean | null
          base_cost: number | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          base_cost?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          base_cost?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          carrier_id: string | null
          created_at: string | null
          delivery_cost: number | null
          estimated_days: number | null
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carrier_id?: string | null
          created_at?: string | null
          delivery_cost?: number | null
          estimated_days?: number | null
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carrier_id?: string | null
          created_at?: string | null
          delivery_cost?: number | null
          estimated_days?: number | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          address: string
          alerts_enabled: boolean
          audio_alerts_enabled: boolean
          auto_backup_frequency: string
          auto_print_on_save: boolean
          color_palette: string
          commercial_register: string
          created_at: string
          critical_overdue_days: number
          currency: string
          custom_expense_categories: string[]
          default_due_day: number
          default_installment_months: number
          default_vat_rate: number
          email: string
          enable_vat: boolean
          footer_note: string
          hide_cost_and_profits_from_cashier: boolean
          id: string
          invoice_prefix: string
          logo_url: string | null
          low_stock_threshold: number
          manager_pin: string | null
          max_discount_without_pin: number | null
          numerals_format: string
          open_cash_drawer_on_print: boolean
          phone: string
          prevent_invoice_deletion_without_pin: boolean
          prevent_viewing_total_analytics_without_pin: boolean
          print_paper: string
          reminder_days_before: number
          shop_name: string
          tax_number: string
          theme: string
          thermal_paper_width: string | null
          thermal_show_barcode: boolean
          thermal_show_header: boolean
          updated_at: string
          user_id: string
          warranty_policy: string
          website: string
          whatsapp: string
          whatsapp_payment_thank_you_template: string
          whatsapp_reminder_template: string
        }
        Insert: {
          address?: string
          alerts_enabled?: boolean
          audio_alerts_enabled?: boolean
          auto_backup_frequency?: string
          auto_print_on_save?: boolean
          color_palette?: string
          commercial_register?: string
          created_at?: string
          critical_overdue_days?: number
          currency?: string
          custom_expense_categories?: string[]
          default_due_day?: number
          default_installment_months?: number
          default_vat_rate?: number
          email?: string
          enable_vat?: boolean
          footer_note?: string
          hide_cost_and_profits_from_cashier?: boolean
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          low_stock_threshold?: number
          manager_pin?: string | null
          max_discount_without_pin?: number | null
          numerals_format?: string
          open_cash_drawer_on_print?: boolean
          phone?: string
          prevent_invoice_deletion_without_pin?: boolean
          prevent_viewing_total_analytics_without_pin?: boolean
          print_paper?: string
          reminder_days_before?: number
          shop_name?: string
          tax_number?: string
          theme?: string
          thermal_paper_width?: string | null
          thermal_show_barcode?: boolean
          thermal_show_header?: boolean
          updated_at?: string
          user_id: string
          warranty_policy?: string
          website?: string
          whatsapp?: string
          whatsapp_payment_thank_you_template?: string
          whatsapp_reminder_template?: string
        }
        Update: {
          address?: string
          alerts_enabled?: boolean
          audio_alerts_enabled?: boolean
          auto_backup_frequency?: string
          auto_print_on_save?: boolean
          color_palette?: string
          commercial_register?: string
          created_at?: string
          critical_overdue_days?: number
          currency?: string
          custom_expense_categories?: string[]
          default_due_day?: number
          default_installment_months?: number
          default_vat_rate?: number
          email?: string
          enable_vat?: boolean
          footer_note?: string
          hide_cost_and_profits_from_cashier?: boolean
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          low_stock_threshold?: number
          manager_pin?: string | null
          max_discount_without_pin?: number | null
          numerals_format?: string
          open_cash_drawer_on_print?: boolean
          phone?: string
          prevent_invoice_deletion_without_pin?: boolean
          prevent_viewing_total_analytics_without_pin?: boolean
          print_paper?: string
          reminder_days_before?: number
          shop_name?: string
          tax_number?: string
          theme?: string
          thermal_paper_width?: string | null
          thermal_show_barcode?: boolean
          thermal_show_header?: boolean
          updated_at?: string
          user_id?: string
          warranty_policy?: string
          website?: string
          whatsapp?: string
          whatsapp_payment_thank_you_template?: string
          whatsapp_reminder_template?: string
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          hours_worked: number | null
          id: string
          staff_id: string
          status: string
          user_id: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          staff_id: string
          status?: string
          user_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          staff_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          branch_id: string | null
          commission_rate: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          permissions: Json | null
          phone: string | null
          pin: string | null
          role: string
          salary: number
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          permissions?: Json | null
          phone?: string | null
          pin?: string | null
          role?: string
          salary?: number
          user_id: string
        }
        Update: {
          branch_id?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          permissions?: Json | null
          phone?: string | null
          pin?: string | null
          role?: string
          salary?: number
          user_id?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          created_at: string
          delta: number
          id: string
          notes: string | null
          reason: string
          stock_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          notes?: string | null
          reason: string
          stock_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          notes?: string | null
          reason?: string
          stock_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          id: string
          item_type: string | null
          last_unit_cost: number
          low_stock_alert: number | null
          min_stock: number
          name: string
          notes: string | null
          quantity: number
          sale_price: number
          season: string | null
          size: string | null
          updated_at: string
          user_id: string
          variants: Json
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          item_type?: string | null
          last_unit_cost?: number
          low_stock_alert?: number | null
          min_stock?: number
          name: string
          notes?: string | null
          quantity?: number
          sale_price?: number
          season?: string | null
          size?: string | null
          updated_at?: string
          user_id: string
          variants?: Json
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          item_type?: string | null
          last_unit_cost?: number
          low_stock_alert?: number | null
          min_stock?: number
          name?: string
          notes?: string | null
          quantity?: number
          sale_price?: number
          season?: string | null
          size?: string | null
          updated_at?: string
          user_id?: string
          variants?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          stock_item_id: string | null
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          stock_item_id?: string | null
          unit_cost?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          stock_item_id?: string | null
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          id: string
          paid_at: string
          supplier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          id?: string
          paid_at?: string
          supplier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          paid_at?: string
          supplier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string
          created_at: string
          id: string
          name: string
          national_id: string | null
          notes: string | null
          opening_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contact?: string
          created_at?: string
          id?: string
          name: string
          national_id?: string | null
          notes?: string | null
          opening_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          name?: string
          national_id?: string | null
          notes?: string | null
          opening_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      treasury_accounts: {
        Row: {
          account_number: string | null
          active: boolean
          bank_name: string | null
          color: string
          created_at: string
          id: string
          initial_balance: number
          local_key: string | null
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          active?: boolean
          bank_name?: string | null
          color?: string
          created_at?: string
          id?: string
          initial_balance?: number
          local_key?: string | null
          name: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          active?: boolean
          bank_name?: string | null
          color?: string
          created_at?: string
          id?: string
          initial_balance?: number
          local_key?: string | null
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treasury_denomination_audits: {
        Row: {
          account_key: string
          audit_number: string
          counted_at: string
          counted_by: string | null
          created_at: string
          denominations: Json
          id: string
          notes: string | null
          status: string
          system_expected_cash: number
          total_actual_cash: number
          updated_at: string
          user_id: string
          variance: number
          variance_reason: string | null
        }
        Insert: {
          account_key: string
          audit_number: string
          counted_at?: string
          counted_by?: string | null
          created_at?: string
          denominations?: Json
          id?: string
          notes?: string | null
          status?: string
          system_expected_cash?: number
          total_actual_cash?: number
          updated_at?: string
          user_id: string
          variance?: number
          variance_reason?: string | null
        }
        Update: {
          account_key?: string
          audit_number?: string
          counted_at?: string
          counted_by?: string | null
          created_at?: string
          denominations?: Json
          id?: string
          notes?: string | null
          status?: string
          system_expected_cash?: number
          total_actual_cash?: number
          updated_at?: string
          user_id?: string
          variance?: number
          variance_reason?: string | null
        }
        Relationships: []
      }
      treasury_manual_transactions: {
        Row: {
          account_key: string
          amount: number
          category: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          performed_by: string | null
          reference_number: string | null
          title: string
          tx_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_key: string
          amount?: number
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          performed_by?: string | null
          reference_number?: string | null
          title: string
          tx_date?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_key?: string
          amount?: number
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          performed_by?: string | null
          reference_number?: string | null
          title?: string
          tx_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treasury_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          fee: number
          from_account_id: string | null
          id: string
          reference_number: string | null
          to_account_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          fee?: number
          from_account_id?: string | null
          id?: string
          reference_number?: string | null
          to_account_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          fee?: number
          from_account_id?: string | null
          id?: string
          reference_number?: string | null
          to_account_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_transfers: {
        Row: {
          amount: number
          created_at: string
          fee: number
          fee_recorded_as_expense: boolean
          from_account_key: string
          id: string
          notes: string | null
          performed_by: string | null
          reference_number: string | null
          to_account_key: string
          transfer_date: string
          transfer_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          fee?: number
          fee_recorded_as_expense?: boolean
          from_account_key: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          reference_number?: string | null
          to_account_key: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee?: number
          fee_recorded_as_expense?: boolean
          from_account_key?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          reference_number?: string | null
          to_account_key?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
          user_id?: string
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
      warehouse_items: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity: number
          sale_price: number
          season: string
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          sale_price?: number
          season?: string
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          sale_price?: number
          season?: string
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_backup_manager: { Args: never; Returns: undefined }
      assign_storefront_shipment: {
        Args: {
          p_carrier_id: string
          p_invoice_id: string
          p_tracking_number: string
          p_zone_id: string
        }
        Returns: undefined
      }
      create_invoice_shipment: {
        Args: {
          p_carrier_id?: string
          p_invoice_id: string
          p_tracking_number?: string
          p_zone_id?: string
        }
        Returns: {
          actual_delivery_date: string | null
          carrier_id: string | null
          cod_amount: number
          collected_at: string | null
          collection_status: string
          created_at: string | null
          delivered_at: string | null
          delivery_address: string | null
          expected_delivery_date: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          pieces: number
          processing_at: string | null
          recipient_name: string | null
          recipient_phone: string | null
          returned_at: string | null
          settled_at: string | null
          shipped_at: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["shipment_status"] | null
          status_updated_by: string | null
          tracking_number: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number
          zone_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sale_return: {
        Args: { p_invoice_id: string; p_items: Json; p_reason: string }
        Returns: string
      }
      delete_invoice_payment: { Args: { p_payment_id: string }; Returns: Json }
      delete_purchase_with_inventory: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      get_admin_pin_hash: { Args: { _user_id: string }; Returns: string }
      get_storefront_analytics_summary: {
        Args: { p_from?: string; p_storefront_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_store_order_installment:
        | {
            Args: {
              p_down_payment: number
              p_first_due_date: string
              p_monthly_installment: number
              p_order_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_down_payment: number
              p_first_due_date: string
              p_installment_count?: number
              p_monthly_installment: number
              p_order_id: string
            }
            Returns: Json
          }
      recalculate_invoice_paid: {
        Args: { p_invoice_id: string }
        Returns: number
      }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_paid_at?: string
          p_payment_id?: string
        }
        Returns: Json
      }
      record_purchase_with_inventory: {
        Args: {
          p_items: Json
          p_notes: string
          p_payment_type: string
          p_purchase_date: string
          p_purchase_id?: string
          p_supplier_id: string
          p_total: number
        }
        Returns: string
      }
      record_storefront_event: {
        Args: {
          p_event_name: string
          p_product_id?: string
          p_source?: string
          p_storefront_id: string
        }
        Returns: undefined
      }
      redeem_storefront_coupon: {
        Args: { p_coupon_id: string; p_order_id: string }
        Returns: number
      }
      restore_backup: {
        Args: { p_dry_run?: boolean; p_exported_by?: string; p_tables: Json }
        Returns: Json
      }
      set_admin_pin: {
        Args: { _new_pin: string; _user_id: string }
        Returns: undefined
      }
      set_manager_pin: {
        Args: { _new_pin: string; _user_id: string }
        Returns: undefined
      }
      settle_carrier_collections: {
        Args: { p_carrier_id: string }
        Returns: number
      }
      sync_late_shipment_notifications: { Args: never; Returns: number }
      update_invoice_payment: {
        Args: { p_amount: number; p_payment_id: string }
        Returns: Json
      }
      update_purchase_with_inventory: {
        Args: {
          p_items: Json
          p_notes: string
          p_payment_type: string
          p_purchase_date: string
          p_purchase_id: string
          p_supplier_id: string
          p_total: number
        }
        Returns: undefined
      }
      update_storefront_shipment_status: {
        Args: {
          p_reason?: string
          p_shipment_id: string
          p_status: Database["public"]["Enums"]["shipment_status"]
        }
        Returns: undefined
      }
      verify_admin_pin: {
        Args: { _pin: string; _user_id: string }
        Returns: boolean
      }
      verify_manager_pin: {
        Args: { _pin: string; _user_id: string }
        Returns: boolean
      }
      wipe_user_data: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "owner" | "manager" | "seller"
      shipment_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "manager", "seller"],
      shipment_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
    },
  },
} as const
