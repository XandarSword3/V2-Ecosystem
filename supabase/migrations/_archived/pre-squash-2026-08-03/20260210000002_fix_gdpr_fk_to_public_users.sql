-- Fix GDPR foreign keys: change from auth.users to public.users
-- Our app uses custom auth with public.users table, not Supabase auth.users

-- gdpr_consents: drop old FK, add new one referencing public.users
ALTER TABLE gdpr_consents DROP CONSTRAINT IF EXISTS gdpr_consents_user_id_fkey;
ALTER TABLE gdpr_consents ADD CONSTRAINT gdpr_consents_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- gdpr_export_requests: drop old FK, add new one referencing public.users
ALTER TABLE gdpr_export_requests DROP CONSTRAINT IF EXISTS gdpr_export_requests_user_id_fkey;
ALTER TABLE gdpr_export_requests ADD CONSTRAINT gdpr_export_requests_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- gdpr_deletion_requests: also fix for consistency
ALTER TABLE gdpr_deletion_requests DROP CONSTRAINT IF EXISTS gdpr_deletion_requests_user_id_fkey;
ALTER TABLE gdpr_deletion_requests ADD CONSTRAINT gdpr_deletion_requests_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- gdpr_deletion_requests.approved_by also references auth.users
ALTER TABLE gdpr_deletion_requests DROP CONSTRAINT IF EXISTS gdpr_deletion_requests_approved_by_fkey;
ALTER TABLE gdpr_deletion_requests ADD CONSTRAINT gdpr_deletion_requests_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
