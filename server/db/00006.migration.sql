-- ============================
-- metrics_climate
-- Stores temperature and humidity readings per room over time.
-- ============================
CREATE TABLE IF NOT EXISTS public.metrics_climate (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    room_id text NOT NULL,
    room_name text NOT NULL,
    temperature numeric,
    humidity numeric,
    CONSTRAINT metrics_climate_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS metrics_climate_room_time_idx
    ON public.metrics_climate (room_id, recorded_at DESC);

-- ============================
-- metrics_device_actions
-- Stores device action events per room and device.
-- ============================
CREATE TABLE IF NOT EXISTS public.metrics_device_actions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    room_id text NOT NULL,
    room_name text NOT NULL,
    device_id text NOT NULL,
    action_id text NOT NULL,
    CONSTRAINT metrics_device_actions_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS metrics_device_actions_room_device_time_idx
    ON public.metrics_device_actions (room_id, device_id, recorded_at DESC);
