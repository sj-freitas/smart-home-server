CREATE TABLE
    IF NOT EXISTS public.mel_cloud_auth_cookies (
        id uuid NOT NULL DEFAULT gen_random_uuid (),
        created_at timestamptz NOT NULL DEFAULT now (),
        cookies text NOT NULL,
        CONSTRAINT mel_cloud_auth_cookies_pkey PRIMARY KEY (id)
    ) TABLESPACE pg_default;
