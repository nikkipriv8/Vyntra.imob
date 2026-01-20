-- Security fixes: tighten WhatsApp conversation access and add migration audit logging

-- 1) Remove overly permissive WhatsApp conversations policy (was USING (true))
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.whatsapp_conversations;

-- Ensure a safe staff-scoped SELECT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_conversations'
      AND policyname = 'Staff can view WhatsApp conversations'
  ) THEN
    CREATE POLICY "Staff can view WhatsApp conversations"
    ON public.whatsapp_conversations
    FOR SELECT
    USING (
      auth.uid() IS NOT NULL
      AND (
        public.is_admin(auth.uid())
        OR public.has_role(auth.uid(), 'broker'::public.user_role)
        OR public.has_role(auth.uid(), 'attendant'::public.user_role)
      )
    );
  END IF;
END $$;

-- 2) Create a migration audit table for backend function actions
CREATE TABLE IF NOT EXISTS public.migration_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  entity text NULL,
  record_count integer NULL,
  success boolean NOT NULL,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.migration_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DROP POLICY IF EXISTS "Admins can view migration audit logs" ON public.migration_audit_log;
CREATE POLICY "Admins can view migration audit logs"
ON public.migration_audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

-- No client-side INSERT/UPDATE/DELETE policies on migration_audit_log (service role writes only)
