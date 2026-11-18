import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para uso em Server Components / Route Handlers / Server Actions.
// Só é chamado quando o app estiver de fato integrado ao Supabase — enquanto
// isso, as páginas usam lib/mock/data.ts e lib/auth.ts (sessão mockada).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // set() chamado a partir de um Server Component: ignorável se
            // houver um proxy/middleware renovando a sessão.
          }
        },
      },
    },
  );
}
