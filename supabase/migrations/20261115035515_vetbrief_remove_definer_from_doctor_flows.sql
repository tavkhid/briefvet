/*
# Remove SECURITY DEFINER from doctor-facing access; limit token functions to the service role

Plain-English summary:
Doctor access no longer relies on privileged helper functions. Doctor reads and writes are
checked by ordinary row rules that look at the doctor's own staff link. The "email confirmed"
flag is copied from the auth system into the staff link, so the rules never need to read the
auth tables. Creating a visit now runs with the doctor's own permissions, limited by the rules.
The token-based owner functions are no longer callable by anonymous or signed-in browser
clients; they are reached only through a server-side function that uses the service role.

1. Changed tables
- `clinic_staff`: new column `email_confirmed` (boolean). Filled from the auth record at
  signup and kept in sync when the email is confirmed.

2. Removed
- `current_clinic_ids()` helper function. Its logic is now written inline in each policy.

3. Triggers and functions
- `handle_new_vet()` (on signup): also records the email confirmation state.
- `sync_vet_email_confirmation()` (on email confirmation): updates `clinic_staff.email_confirmed`.
  Both are not callable by browser roles.
- `create_visit(...)`: now runs with the caller's permissions (not the owner's).

4. Security
- Doctor read policies on `clinics`, `owners`, `pets`, `visits`, `prescriptions`, `reminders`
  check the caller's staff link and the confirmed flag.
- New insert and update policies for `owners`, `pets`, `visits`, `prescriptions`, `reminders`,
  limited to the caller's own clinic. Only the listed columns are writable.
- `get_visit_by_token` and `set_reminder_status` are executable only by `service_role`.
  Anonymous and signed-in browsers can no longer call them directly.

5. Important notes
- The owner page and the "Дал / Пропустил" buttons now go through the `owner-visit` server
  function, which checks the token and calls these functions with the service role.
*/

ALTER TABLE public.clinic_staff ADD COLUMN IF NOT EXISTS email_confirmed boolean NOT NULL DEFAULT false;

UPDATE public.clinic_staff cs
SET email_confirmed = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u
WHERE u.id = cs.user_id;

DROP POLICY IF EXISTS "select_member_clinics" ON public.clinics;
CREATE POLICY "select_member_clinics" ON public.clinics FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));

DROP POLICY IF EXISTS "select_member_owners" ON public.owners;
CREATE POLICY "select_member_owners" ON public.owners FOR SELECT
  TO authenticated
  USING (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));

DROP POLICY IF EXISTS "select_member_pets" ON public.pets;
CREATE POLICY "select_member_pets" ON public.pets FOR SELECT
  TO authenticated
  USING (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));

DROP POLICY IF EXISTS "select_member_visits" ON public.visits;
CREATE POLICY "select_member_visits" ON public.visits FOR SELECT
  TO authenticated
  USING (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));

DROP POLICY IF EXISTS "select_member_prescriptions" ON public.prescriptions;
CREATE POLICY "select_member_prescriptions" ON public.prescriptions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.id = prescriptions.visit_id
      AND v.clinic_id IN (
        SELECT cs.clinic_id FROM public.clinic_staff cs
        WHERE cs.user_id = auth.uid() AND cs.email_confirmed
      )
  ));

DROP POLICY IF EXISTS "select_member_reminders" ON public.reminders;
CREATE POLICY "select_member_reminders" ON public.reminders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.prescriptions pr
    JOIN public.visits v ON v.id = pr.visit_id
    WHERE pr.id = reminders.prescription_id
      AND v.clinic_id IN (
        SELECT cs.clinic_id FROM public.clinic_staff cs
        WHERE cs.user_id = auth.uid() AND cs.email_confirmed
      )
  ));

DROP FUNCTION IF EXISTS public.current_clinic_ids();

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

  INSERT INTO public.clinic_staff (clinic_id, user_id, email_confirmed)
  VALUES (v_clinic_id, NEW.id, NEW.email_confirmed_at IS NOT NULL);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_vet() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_vet_email_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clinic_staff
  SET email_confirmed = (NEW.email_confirmed_at IS NOT NULL)
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_vet_email_confirmation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.sync_vet_email_confirmation();

GRANT INSERT (clinic_id, name, phone) ON public.owners TO authenticated;
GRANT UPDATE (name, updated_at) ON public.owners TO authenticated;
DROP POLICY IF EXISTS "insert_member_owners" ON public.owners;
CREATE POLICY "insert_member_owners" ON public.owners FOR INSERT
  TO authenticated
  WITH CHECK (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));
DROP POLICY IF EXISTS "update_member_owners" ON public.owners;
CREATE POLICY "update_member_owners" ON public.owners FOR UPDATE
  TO authenticated
  USING (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ))
  WITH CHECK (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));

GRANT INSERT (clinic_id, owner_id, name, species, breed, weight_kg, birth_date) ON public.pets TO authenticated;
GRANT UPDATE (breed, weight_kg, birth_date, updated_at) ON public.pets TO authenticated;
DROP POLICY IF EXISTS "insert_member_pets" ON public.pets;
CREATE POLICY "insert_member_pets" ON public.pets FOR INSERT
  TO authenticated
  WITH CHECK (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));
DROP POLICY IF EXISTS "update_member_pets" ON public.pets;
CREATE POLICY "update_member_pets" ON public.pets FOR UPDATE
  TO authenticated
  USING (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ))
  WITH CHECK (clinic_id IN (
    SELECT cs.clinic_id FROM public.clinic_staff cs
    WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  ));

GRANT INSERT (clinic_id, pet_id, vet_id, diagnosis, next_visit_date, notes) ON public.visits TO authenticated;
DROP POLICY IF EXISTS "insert_member_visits" ON public.visits;
CREATE POLICY "insert_member_visits" ON public.visits FOR INSERT
  TO authenticated
  WITH CHECK (
    vet_id = auth.uid()
    AND clinic_id IN (
      SELECT cs.clinic_id FROM public.clinic_staff cs
      WHERE cs.user_id = auth.uid() AND cs.email_confirmed
    )
  );

GRANT INSERT (visit_id, medication_name, dose, frequency_per_day, duration_days, first_dose_at) ON public.prescriptions TO authenticated;
DROP POLICY IF EXISTS "insert_member_prescriptions" ON public.prescriptions;
CREATE POLICY "insert_member_prescriptions" ON public.prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.id = prescriptions.visit_id
      AND v.clinic_id IN (
        SELECT cs.clinic_id FROM public.clinic_staff cs
        WHERE cs.user_id = auth.uid() AND cs.email_confirmed
      )
  ));

GRANT INSERT (prescription_id, scheduled_at) ON public.reminders TO authenticated;
DROP POLICY IF EXISTS "insert_member_reminders" ON public.reminders;
CREATE POLICY "insert_member_reminders" ON public.reminders FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.prescriptions pr
    JOIN public.visits v ON v.id = pr.visit_id
    WHERE pr.id = reminders.prescription_id
      AND v.clinic_id IN (
        SELECT cs.clinic_id FROM public.clinic_staff cs
        WHERE cs.user_id = auth.uid() AND cs.email_confirmed
      )
  ));

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
SECURITY INVOKER
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
  SELECT cs.clinic_id INTO v_clinic_id
  FROM public.clinic_staff cs
  WHERE cs.user_id = auth.uid() AND cs.email_confirmed
  LIMIT 1;
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

REVOKE EXECUTE ON FUNCTION public.get_visit_by_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_by_token(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_reminder_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_reminder_status(uuid, uuid, text) TO service_role;
