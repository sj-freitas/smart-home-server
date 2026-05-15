CREATE TABLE
    IF NOT EXISTS public.scheduled_actions (
        id uuid NOT NULL DEFAULT gen_random_uuid (),
        created_at timestamptz NOT NULL DEFAULT now (),
        execute_at timestamptz NOT NULL,
        action_path text NOT NULL,
        CONSTRAINT scheduled_actions_pkey PRIMARY KEY (id)
    ) TABLESPACE pg_default;
