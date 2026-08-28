-- ============================
-- mel_cloud_home_auth_cookies
-- Stores the MelCloud session cookie string. The most recently created
-- row is the one currently in use.
-- ============================
CREATE TABLE IF NOT EXISTS public.mel_cloud_home_auth_cookies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    cookies text NOT NULL,
    CONSTRAINT mel_cloud_home_auth_cookies_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS mel_cloud_home_auth_cookies_created_at_idx
    ON public.mel_cloud_home_auth_cookies (created_at DESC);
