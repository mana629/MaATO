
-- PROFILES: one per auth user, with public system_id
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  system_id text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('passenger','driver')) DEFAULT 'passenger',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read profiles (only exposes system_id + role, no PII)
CREATE POLICY "Authenticated can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- DRIVER PROFILES
CREATE TABLE public.driver_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_number text,
  is_online boolean NOT NULL DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  last_seen timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_profiles TO authenticated;
GRANT ALL ON public.driver_profiles TO service_role;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read online drivers" ON public.driver_profiles
  FOR SELECT TO authenticated USING (is_online = true OR user_id = auth.uid());
CREATE POLICY "Driver manages own profile" ON public.driver_profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PASSENGER REQUESTS
CREATE TABLE public.passenger_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination_label text NOT NULL,
  destination_lat double precision,
  destination_lng double precision,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  passenger_count int NOT NULL DEFAULT 1 CHECK (passenger_count BETWEEN 1 AND 6),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','cancelled','completed')),
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_requests TO authenticated;
GRANT ALL ON public.passenger_requests TO service_role;
ALTER TABLE public.passenger_requests ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can see open requests, plus their own (any status), plus ones they accepted
CREATE POLICY "Read open or own requests" ON public.passenger_requests
  FOR SELECT TO authenticated
  USING (status = 'open' OR passenger_id = auth.uid() OR accepted_by = auth.uid());

-- Passenger creates own
CREATE POLICY "Passenger creates own request" ON public.passenger_requests
  FOR INSERT TO authenticated WITH CHECK (passenger_id = auth.uid());

-- Passenger updates own (cancel, complete); a driver can accept an open request by setting accepted_by = self
CREATE POLICY "Passenger updates own" ON public.passenger_requests
  FOR UPDATE TO authenticated USING (passenger_id = auth.uid()) WITH CHECK (passenger_id = auth.uid());
CREATE POLICY "Driver accepts open request" ON public.passenger_requests
  FOR UPDATE TO authenticated
  USING (status = 'open')
  WITH CHECK (accepted_by = auth.uid() AND status IN ('accepted','completed'));

-- Auto-create profile on signup with random system_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_sid text;
  prefix text;
  user_role text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'passenger');
  prefix := CASE WHEN user_role = 'driver' THEN 'DRV-' ELSE 'USR-' END;
  new_sid := prefix || upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 4));
  INSERT INTO public.profiles (id, system_id, role) VALUES (NEW.id, new_sid, user_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime
ALTER TABLE public.driver_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.passenger_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_requests;
