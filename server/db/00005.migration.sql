-- ============================
-- auth_oauth_clients
-- ============================
CREATE TABLE
    IF NOT EXISTS public.auth_oauth_clients (
        client_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now (),
        -- Encrypted (reversible), since the SDK's client-auth middleware compares
        -- this value directly against the secret presented by the client.
        client_secret_encrypted text,
        client_id_issued_at bigint NOT NULL,
        client_secret_expires_at bigint NOT NULL DEFAULT 0,
        metadata jsonb NOT NULL,
        CONSTRAINT auth_oauth_clients_pkey PRIMARY KEY (client_id)
    ) TABLESPACE pg_default;

-- ============================
-- auth_oauth_pending_authorizations
-- ============================
CREATE TABLE
    IF NOT EXISTS public.auth_oauth_pending_authorizations (
        id uuid NOT NULL DEFAULT gen_random_uuid (),
        created_at timestamptz NOT NULL DEFAULT now (),
        client_id text NOT NULL,
        redirect_uri text NOT NULL,
        code_challenge text NOT NULL,
        state text,
        scopes jsonb,
        resource text,
        expires_at timestamptz NOT NULL,
        CONSTRAINT auth_oauth_pending_authorizations_pkey PRIMARY KEY (id)
    ) TABLESPACE pg_default;

-- ============================
-- auth_oauth_codes
-- ============================
CREATE TABLE
    IF NOT EXISTS public.auth_oauth_codes (
        code_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now (),
        client_id text NOT NULL,
        redirect_uri text NOT NULL,
        code_challenge text NOT NULL,
        email text NOT NULL,
        resource text,
        expires_at timestamptz NOT NULL,
        CONSTRAINT auth_oauth_codes_pkey PRIMARY KEY (code_hash)
    ) TABLESPACE pg_default;

-- ============================
-- auth_oauth_tokens
-- ============================
CREATE TABLE
    IF NOT EXISTS public.auth_oauth_tokens (
        id uuid NOT NULL DEFAULT gen_random_uuid (),
        created_at timestamptz NOT NULL DEFAULT now (),
        access_token_hash text NOT NULL,
        refresh_token_hash text,
        client_id text NOT NULL,
        email text NOT NULL,
        resource text,
        access_token_expires_at timestamptz NOT NULL,
        refresh_token_expires_at timestamptz,
        CONSTRAINT auth_oauth_tokens_pkey PRIMARY KEY (id),
        CONSTRAINT auth_oauth_tokens_access_token_hash_key UNIQUE (access_token_hash),
        CONSTRAINT auth_oauth_tokens_refresh_token_hash_key UNIQUE (refresh_token_hash)
    ) TABLESPACE pg_default;
