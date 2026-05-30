import type { APIRoute } from 'astro';
import { createClient } from '../../../../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect('/dashboard?error=blad-konfiguracji');
  }

  const { id, contactId } = context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return context.redirect('/auth/signin');
  }

  // Intentionally no .select() — idempotent delete, 0-row result is not an error. (contact-management plan Phase 2.)
  // RLS additionally enforces ownership via the listing_id subquery policy.
  const { error: deleteError } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('listing_id', id);

  if (deleteError) {
    return context.redirect(`/dashboard/listings/${id}/contacts?error=blad-usuniecia`);
  }

  return context.redirect(`/dashboard/listings/${id}/contacts`);
};
