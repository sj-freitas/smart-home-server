-- ============================
-- home_info
-- Stores markdown description entries for a home. The most recently created
-- entry for a given home_id is the one served.
-- ============================
CREATE TABLE IF NOT EXISTS public.home_info (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    home_id text NOT NULL,
    markdown text NOT NULL,
    CONSTRAINT home_info_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS home_info_home_id_created_at_idx
    ON public.home_info (home_id, created_at DESC);

-- ============================
-- home_info_images
-- Stores base64-encoded JPEG images associated with a home, served statically
-- from the database under /static/images/:homeId/:name.
-- ============================
CREATE TABLE IF NOT EXISTS public.home_info_images (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    home_id text NOT NULL,
    name text NOT NULL,
    image_base64 text NOT NULL,
    CONSTRAINT home_info_images_pkey PRIMARY KEY (id),
    CONSTRAINT home_info_images_home_id_name_key UNIQUE (home_id, name)
) TABLESPACE pg_default;
