-- ============================
-- auth_emails: add role
-- Adds a role dimension to email grants so each row represents
-- (email, role, validity window) instead of just a blanket allow.
-- ============================
ALTER TABLE public.auth_emails
    ADD COLUMN role text;

-- Backfill: every pre-existing grant becomes a Guest grant.
UPDATE public.auth_emails SET role = 'Guest' WHERE role IS NULL;

ALTER TABLE public.auth_emails
    ALTER COLUMN role SET NOT NULL,
    ADD CONSTRAINT auth_emails_role_check CHECK (role IN ('Admin', 'Guest', 'User'));

CREATE INDEX IF NOT EXISTS auth_emails_email_address_role_idx
    ON public.auth_emails (email_address, role);
