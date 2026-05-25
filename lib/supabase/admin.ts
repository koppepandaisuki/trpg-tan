import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (service_role).
 *
 * !!! DO NOT IMPORT FROM CLIENT COMPONENTS !!!
 * `import 'server-only'` will throw at build time if a client bundle imports this.
 *
 * Reserved for:
 *   - Phase 6: signed URL issuance for product-files
 *   - Phase 7: Stripe webhook handler writing purchases
 *   - Phase 8: admin Server Actions writing admin_audit_logs
 *
 * Phase 3 does not call this. The file exists so the import boundary is
 * established early and accidentally widening it gets flagged in review.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are missing");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
