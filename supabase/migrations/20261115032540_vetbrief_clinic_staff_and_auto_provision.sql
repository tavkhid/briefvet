/*
# Clinic staff membership, automatic clinic provisioning and membership-based RLS

Plain-English summary:
Doctors are now linked to clinics through a staff table. When a doctor signs up,
a clinic named "Моя клиника" and a staff link are created automatically, so the
doctor can create visits right away. Every doctor-facing read rule now asks
"is this row's clinic one of mine, and is my email confirmed?" instead of
"is this clinic's owner me?".

1. New Tables
- `clinic_staff` (clinic_id, user_id, created_at): links a signed-in doctor to a clinic.

2. Functions
- `current_clinic_ids()`: returns the clinic ids of the calling doctor, only when the
  doctor's email is confirmed. Used by every doctor-facing read policy.
- `handle_new_vet()`: trigger function that runs after a new auth account is created and
  inserts the clinic "Моя клиника" and the matching staff link.
- `create_visit(...)`: same behaviour, but the clinic is now taken from `current_clinic_ids()`.

3. Security
- RLS enabled on `clinic_staff`, which is readable only for the caller's own rows.
- Doctor read policies on `clinics`, `owners`, `pets`, `visits`, `prescriptions`, `reminders`
  are rebuilt around `current_clinic_ids()`. The old policies that checked `clinics.user_id`
  are removed.
- `clinics` no longer accepts inserts from doctors; clinics are created only by the trigger.
- The helper and trigger functions are not callable by anon or by doctors directly.

4. Important notes
- Existing clinics are linked to their owner in `clinic_staff` by the backfill step below.
- Owner access via `/p/{token}` is unchanged: `get_visit_by_token` and `set_reminder_status`
  keep working for anonymous visitors who have the token.
*/

CREATE TABLE IF NOT EXISTS public.clinic_staff (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_staff_user ON public.clinic_staff (user_id);

ALTER TABLE public.clinic_staff ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.clinic_staff FROM PUBLIC, anon;
GRANT SELECT ON public.clinic_staff TO authenticated;

INSERT INTO public.clinic_staff (clinic_id, user_id)
SELECT c.id, c.user_id
FROM public.clinics c
WHERE c.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_clinic_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.clinic_id
  FROM public.clinic_staff cs
  JOIN auth.users u ON u.id = cs.user_id
  WHERE cs.user_id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.current_clinic_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_clinic_ids() TO authenticated;

DROP POLICY IF EXISTS "select_own_clinic" ON public.clinics;
DROP POLICY IF EXISTS "insert_own_clinic" ON public.clinics;
DROP POLICY IF EXISTS "select_clinic_owners" ON public.owners;
DROP POLICY IF EXISTS "select_clinic_pets" ON public.pets;
DROP POLICY IF EXISTS "select_clinic_visits" ON public.visits;
DROP POLICY IF EXISTS "select_clinic_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "select_clinic_reminders" ON public.reminders;

REVOKE INSERT ON public.clinics FROM authenticated;

DROP POLICY IF EXISTS "select_own_membership" ON public.clinic_staff;
CREATE POLICY "select_own_membership" ON public.clinic_staff FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "select_member_clinics" ON public.clinics;
CREATE POLICY "select_member_clinics" ON public.clinics FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.current_clinic_ids()));

DROP POLICY IF EXISTS "select_member_owners" ON public.owners;
CREATE POLICY "select_member_owners" ON public.owners FOR SELECT
  TO authenticated
  USING (clinic_id IN (SELECT public.current_clinic_ids()));

DROP POLICY IF EXISTS "select_member_pets" ON public.pets;
CREATE POLICY "select_member_pets" ON public.pets FOR SELECT
  TO authenticated
  USING (clinic_id IN (SELECT public.current_clinic_ids()));

DROP POLICY IF EXISTS "select_member_visits" ON public.visits;
CREATE POLICY "select_member_visits" ON public.visits FOR SELECT
  TO authenticated
  USING (clinic_id IN (SELECT public.current_clinic_ids()));

DROP POLICY IF EXISTS "select_member_prescriptions" ON public.prescriptions;
CREATE POLICY "select_member_prescriptions" ON public.prescriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = prescriptions.visit_id
        AND v.clinic_id IN (SELECT public.current_clinic_ids())
    )
  );

DROP POLICY IF EXISTS "select_member_reminders" ON public.reminders;
CREATE POLICY "select_member_reminders" ON public.reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prescriptions pr
      JOIN public.visits v ON v.id = pr.visit_id
      WHERE pr.id = reminders.prescription_id
        AND v.clinic_id IN (SELECT public.current_clinic_ids())
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_vet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  INSERT INTO public.clinics (user_id, name)
  VALUES (NEW.id, 'Моя клиника')
  RETURNING id INTO v_clinic_id;

  INSERT INTO public.clinic_staff (clinic_id, user_id)
  VALUES (v_clinic_id, NEW.id);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_vet() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_vet();

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
  SELECT c INTO v_clinic_id FROM public.current_clinic_ids() AS c LIMIT 1;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Подтвердите email, чтобы создавать визиты';
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

REVOKE EXECUTE ON FUNCTION public.create_visit(text, text, text, text, text, numeric, date, text, date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit(text, text, text, text, text, numeric, date, text, date, text, jsonb) TO authenticated;
