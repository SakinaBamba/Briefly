export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]


export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          user_id: string
          opportunity_id: string | null
          client_id: string | null
          summary: string | null
          created_at: string
          title: string | null
          transcript: string | null
        }
        Insert: {
          id?: string
          user_id: string
          opportunity_id?: string | null
          client_id?: string | null
          summary?: string | null
          created_at?: string
          title?: string | null
          transcript?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          opportunity_id?: string | null
          client_id?: string | null
          summary?: string | null
          created_at?: string
          title?: string | null
          transcript?: string | null
        }
      }
      opportunities: {
        Row: {
          id: string
          client_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
