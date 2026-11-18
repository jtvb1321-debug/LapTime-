import { createBrowserClient } from "@supabase/ssr";

// Cliente para uso em Client Components. Só é chamado quando o app estiver
// de fato integrado ao Supabase — enquanto isso, as páginas usam lib/mock/data.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
