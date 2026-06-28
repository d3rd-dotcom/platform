import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function projectUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const match = (process.env.DATABASE_URL || '').match(/postgres\.([a-z0-9]+)[:.]/i);
  return match ? `https://${match[1]}.supabase.co` : null;
}

function anonKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0cm1wcWdxYWZzeWF0cWFqcm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTk3MjYsImV4cCI6MjA4MjQ3NTcyNn0.5YqEMkFMyUtLrxfwsaxB54k6YHF-0mk30nU7NaMZIj0'
  );
}

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window !== 'undefined' && browserClient) return browserClient;

  const url = projectUrl();
  const key = anonKey();
  if (!url || !key) return null;

  const client = createClient(url, key, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  if (typeof window !== 'undefined') {
    browserClient = client;
  }

  return client;
}
