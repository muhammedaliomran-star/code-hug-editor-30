-- =============================================================
-- Security: Move licenses + admin settings to Supabase
-- Run in Supabase Dashboard > SQL Editor
-- =============================================================

-- ==================== Licenses Table ====================
CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  tier text NOT NULL DEFAULT 'trial',
  tier_label text NOT NULL DEFAULT 'test',
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  shop_name text NOT NULL DEFAULT '',
  shop_address text,
  tax_number text,
  issue_date date NOT NULL DEFAULT current_date,
  expiry_date text NOT NULL DEFAULT 'LIFETIME',
  status text NOT NULL DEFAULT 'active',
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  notes text,
  hardware_included text,
  hardware_items jsonb DEFAULT '[]',
  tax_rate_percent numeric(5,2) DEFAULT 0,
  modules jsonb NOT NULL DEFAULT '{}',
  installments jsonb,
  support_logs jsonb DEFAULT '[]',
  last_active_date date,
  device_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own licenses" ON public.licenses;
CREATE POLICY "Users manage own licenses" ON public.licenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== Admin Settings Table ====================
CREATE TABLE IF NOT EXISTS public.admin_settings (
  user_id uuid PRIMARY KEY,
  admin_pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only owners manage admin settings" ON public.admin_settings;
CREATE POLICY "Only owners manage admin settings" ON public.admin_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND auth.uid() = user_id);

-- ==================== RPC: Verify Admin Pin ====================
CREATE OR REPLACE FUNCTION public.verify_admin_pin(_user_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_settings
    WHERE user_id = _user_id
      AND admin_pin_hash = md5(_pin)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_pin(uuid, text) TO authenticated;

-- ==================== RPC: Set Admin Pin ====================
CREATE OR REPLACE FUNCTION public.set_admin_pin(_user_id uuid, _new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_user_id, 'owner') THEN
    RAISE EXCEPTION 'Only owners can change admin PIN';
  END IF;

  INSERT INTO public.admin_settings (user_id, admin_pin_hash, updated_at)
  VALUES (_user_id, md5(_new_pin), now())
  ON CONFLICT (user_id) DO UPDATE
  SET admin_pin_hash = md5(_new_pin), updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(uuid, text) TO authenticated;

-- ==================== RPC: Get Admin Pin Hash ====================
CREATE OR REPLACE FUNCTION public.get_admin_pin_hash(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_pin_hash FROM public.admin_settings
  WHERE user_id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_pin_hash(uuid) TO authenticated;

-- ==================== RPC: Verify Manager Pin ====================
CREATE OR REPLACE FUNCTION public.verify_manager_pin(_user_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_settings
    WHERE user_id = _user_id
      AND manager_pin IS NOT NULL
      AND manager_pin = md5(_pin)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_manager_pin(uuid, text) TO authenticated;

-- ==================== RPC: Set Manager Pin ====================
CREATE OR REPLACE FUNCTION public.set_manager_pin(_user_id uuid, _new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_user_id, 'owner') THEN
    RAISE EXCEPTION 'Only owners can change manager PIN';
  END IF;

  UPDATE public.shop_settings
  SET manager_pin = md5(_new_pin), updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_manager_pin(uuid, text) TO authenticated;
