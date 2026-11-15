/*
# VetBrief core schema: clinics, patients, visits, prescriptions, reminders

Plain-English summary
- Each veterinary clinic signs up with its own account and can only see its own patients.
- A visit records the owner, the pet, the diagnosis and the prescribed medicines.
- Creating a visit is done by a single database function so that the whole record is saved
  together or not at all, and the dosing schedule is generated automatically.
- Pet owners do NOT need an account. They open a private link (token) from a QR code and can
  see the plan and mark each dose as taken or skipped through two token-gated functions.

1. New Tables
- `clinics`: one clinic per account (`user_id` defaults to the signed-in user).
- `owners`: pet owners of a clinic, identified by phone within that clinic.
- `pets`: animals belonging to an owner, scoped to a clinic.
- `visits`: a vet visit, with diagnosis, notes, next visit date and a secret `access_token` for the QR link.
- `prescriptions`: medicines prescribed in a visit (dose, times per day, duration, first dose time).
- `reminders`: concrete dose times generated from each prescription (status: pending, sent, taken, skipped).

2. Functions
- `create_visit(...)`: signed-in clinic staff only. Saves owner, pet, visit, prescriptions and reminders in one step.
- `get_visit_by_token(token)`: public read of one visit by its secret token. Returns no phone numbers of owners.
- `set_reminder_status(token, reminder_id, status)`: public update of one dose to taken or skipped, only if it belongs to the token's visit.

3. Security
- Row Level Security enabled on every new table.
- Clinic staff can read only rows belonging to their own clinic. Clinics can insert only their own clinic row.
- Anonymous visitors get no direct table access; they reach data only through the two token functions.
- Writes to patient data happen only through `create_visit`, never through direct table inserts.

4. Important notes
- Migration is idempotent: tables and indexes use IF NOT EXISTS, policies are dropped before being created.
- No existing data is modified or removed.
- Doses are spaced evenly across the day from the first dose time (24 / times per day hours apart).
*/

CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinics_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  phone text NOT NULL CHECK (char_length(trim(phone)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS owners_clinic_phone_key ON public.owners (clinic_id, phone);

CREATE TABLE IF NOT EXISTS public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  species text NOT NULL CHECK (char_length(trim(species)) > 0),
  breed text,
  weight_kg numeric(5,2),
  birth_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  diagnosis text,
  next_visit_date date,
  notes text,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  medication_name text NOT NULL CHECK (char_length(trim(medication_name)) > 0),
  dose text NOT NULL CHECK (char_length(trim(dose)) > 0),
  frequency_per_day int NOT NULL CHECK (frequency_per_day BETWEEN 1 AND 12),
  duration_days int NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
  first_dose_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'taken', 'skipped')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pets_clinic ON public.pets (clinic_id);
CREATE INDEX IF NOT EXISTS idx_pets_owner ON public.pets (owner_id);
CREATE INDEX IF NOT EXISTS idx_visits_clinic_created ON public.visits (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_pet ON public.visits (pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON public.prescriptions (visit_id);
CREATE INDEX IF NOT EXISTS idx_reminders_prescription ON public.reminders (prescription_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON public.reminders (scheduled_at) WHERE status = 'pending';

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.clinics TO authenticated;
GRANT SELECT ON public.owners, public.pets, public.visits, public.prescriptions, public.reminders TO authenticated;

DROP POLICY IF EXISTS "select_own_clinic" ON public.clinics;
CREATE POLICY "select_own_clinic" ON public.clinics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_clinic" ON public.clinics;
CREATE POLICY "insert_own_clinic" ON public.clinics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_clinic_owners" ON public.owners;
CREATE POLICY "select_clinic_owners" ON public.owners FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = owners.clinic_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_clinic_pets" ON public.pets;
CREATE POLICY "select_clinic_pets" ON public.pets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = pets.clinic_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_clinic_visits" ON public.visits;
CREATE POLICY "select_clinic_visits" ON public.visits FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = visits.clinic_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_clinic_prescriptions" ON public.prescriptions;
CREATE POLICY "select_clinic_prescriptions" ON public.prescriptions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.visits v
      JOIN public.clinics c ON c.id = v.clinic_id
      WHERE v.id = prescriptions.visit_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_clinic_reminders" ON public.reminders;
CREATE POLICY "select_clinic_reminders" ON public.reminders FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions pr
      JOIN public.visits v ON v.id = pr.visit_id
      JOIN public.clinics c ON c.id = v.clinic_id
      WHERE pr.id = reminders.prescription_id AND c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.create_visit(
  p_owner_name text,
  p_owner_phone text,
  p_pet_name text,
  p_species text,
  p_breed text,
  p_weight_kg numeric,
  p_birth_date date,
  p_diagnosis text,
  p_next_visit_date date,
  p_notes text,
  p_prescriptions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_owner_id uuid;
  v_pet_id uuid;
  v_visit_id uuid;
  v_token uuid;
  v_item jsonb;
  v_prescription_id uuid;
  v_frequency int;
  v_duration int;
  v_first_dose timestamptz;
BEGIN
  SELECT id INTO v_clinic_id FROM public.clinics WHERE user_id = auth.uid();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Сначала создайте профиль клиники';
  END IF;

  IF length(trim(coalesce(p_owner_name, ''))) = 0 OR length(trim(coalesce(p_owner_phone, ''))) = 0 THEN
    RAISE EXCEPTION 'Укажите имя и телефон владельца';
  END IF;

  IF length(trim(coalesce(p_pet_name, ''))) = 0 OR length(trim(coalesce(p_species, ''))) = 0 THEN
    RAISE EXCEPTION 'Укажите имя и вид питомца';
  END IF;

  IF p_prescriptions IS NULL OR jsonb_typeof(p_prescriptions) <> 'array' OR jsonb_array_length(p_prescriptions) = 0 THEN
    RAISE EXCEPTION 'Добавьте хотя бы один препарат';
  END IF;

  INSERT INTO public.owners (clinic_id, name, phone)
  VALUES (v_clinic_id, trim(p_owner_name), trim(p_owner_phone))
  ON CONFLICT (clinic_id, phone) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_owner_id;

  SELECT id INTO v_pet_id
  FROM public.pets
  WHERE owner_id = v_owner_id AND lower(name) = lower(trim(p_pet_name)) AND species = trim(p_species)
  LIMIT 1;

  IF v_pet_id IS NULL THEN
    INSERT INTO public.pets (clinic_id, owner_id, name, species, breed, weight_kg, birth_date)
    VALUES (v_clinic_id, v_owner_id, trim(p_pet_name), trim(p_species), nullif(trim(coalesce(p_breed, '')), ''), p_weight_kg, p_birth_date)
    RETURNING id INTO v_pet_id;
  ELSE
    UPDATE public.pets
    SET breed = coalesce(nullif(trim(coalesce(p_breed, '')), ''), breed),
        weight_kg = coalesce(p_weight_kg, weight_kg),
        birth_date = coalesce(p_birth_date, birth_date),
        updated_at = now()
    WHERE id = v_pet_id;
  END IF;

  INSERT INTO public.visits (clinic_id, pet_id, vet_id, diagnosis, next_visit_date, notes)
  VALUES (v_clinic_id, v_pet_id, auth.uid(), nullif(trim(coalesce(p_diagnosis, '')), ''), p_next_visit_date, nullif(trim(coalesce(p_notes, '')), ''))
  RETURNING id, access_token INTO v_visit_id, v_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_prescriptions) LOOP
    IF length(trim(coalesce(v_item->>'medication_name', ''))) = 0 OR length(trim(coalesce(v_item->>'dose', ''))) = 0 THEN
      RAISE EXCEPTION 'Укажите название и дозировку каждого препарата';
    END IF;

    v_frequency := (v_item->>'frequency_per_day')::int;
    v_duration := (v_item->>'duration_days')::int;
    v_first_dose := (v_item->>'first_dose_at')::timestamptz;

    IF v_frequency IS NULL OR v_frequency NOT BETWEEN 1 AND 12 THEN
      RAISE EXCEPTION 'Частота приёма должна быть от 1 до 12 раз в день';
    END IF;

    IF v_duration IS NULL OR v_duration NOT BETWEEN 1 AND 365 THEN
      RAISE EXCEPTION 'Длительность курса должна быть от 1 до 365 дней';
    END IF;

    IF v_first_dose IS NULL THEN
      RAISE EXCEPTION 'Укажите время первого приёма';
    END IF;

    INSERT INTO public.prescriptions (visit_id, medication_name, dose, frequency_per_day, duration_days, first_dose_at)
    VALUES (v_visit_id, trim(v_item->>'medication_name'), trim(v_item->>'dose'), v_frequency, v_duration, v_first_dose)
    RETURNING id INTO v_prescription_id;

    INSERT INTO public.reminders (prescription_id, scheduled_at)
    SELECT v_prescription_id,
           v_first_dose + make_interval(secs => (g * 86400.0 / v_frequency)::double precision)
    FROM generate_series(0, v_frequency * v_duration - 1) AS g;
  END LOOP;

  RETURN jsonb_build_object('visit_id', v_visit_id, 'access_token', v_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visit_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'diagnosis', v.diagnosis,
    'notes', v.notes,
    'next_visit_date', v.next_visit_date,
    'created_at', v.created_at,
    'pet', jsonb_build_object('name', p.name, 'species', p.species, 'breed', p.breed),
    'clinic', jsonb_build_object('name', c.name, 'phone', c.phone),
    'prescriptions', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'medication_name', pr.medication_name,
          'dose', pr.dose,
          'frequency_per_day', pr.frequency_per_day,
          'duration_days', pr.duration_days,
          'first_dose_at', pr.first_dose_at,
          'reminders', coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', r.id, 'scheduled_at', r.scheduled_at, 'status', r.status) ORDER BY r.scheduled_at)
            FROM public.reminders r
            WHERE r.prescription_id = pr.id
          ), '[]'::jsonb)
        ) ORDER BY pr.created_at
      )
      FROM public.prescriptions pr
      WHERE pr.visit_id = v.id
    ), '[]'::jsonb)
  )
  FROM public.visits v
  JOIN public.pets p ON p.id = v.pet_id
  JOIN public.clinics c ON c.id = v.clinic_id
  WHERE v.access_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.set_reminder_status(p_token uuid, p_reminder_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_status NOT IN ('taken', 'skipped') THEN
    RAISE EXCEPTION 'Недопустимый статус приёма';
  END IF;

  UPDATE public.reminders r
  SET status = p_status, responded_at = now(), updated_at = now()
  FROM public.prescriptions pr
  JOIN public.visits v ON v.id = pr.visit_id
  WHERE r.id = p_reminder_id
    AND r.prescription_id = pr.id
    AND v.access_token = p_token
  RETURNING r.status INTO v_status;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Приём не найден';
  END IF;

  RETURN v_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_visit(text, text, text, text, text, numeric, date, text, date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit(text, text, text, text, text, numeric, date, text, date, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_visit_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visit_by_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_reminder_status(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_reminder_status(uuid, uuid, text) TO anon, authenticated;
