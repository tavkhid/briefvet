/*
# Enforce that owners, pets and visits all belong to the same clinic

Plain-English summary:
A pet must belong to an owner of the same clinic, and a visit must use a pet of the same clinic.
Before this, the database only checked that each record pointed to some existing record, so a
record could point to a pet from another clinic. These constraints make that impossible even if
a request is crafted by hand.
*/

ALTER TABLE public.owners ADD CONSTRAINT owners_id_clinic_key UNIQUE (id, clinic_id);
ALTER TABLE public.pets ADD CONSTRAINT pets_id_clinic_key UNIQUE (id, clinic_id);

ALTER TABLE public.pets
  ADD CONSTRAINT pets_owner_same_clinic_fkey
  FOREIGN KEY (owner_id, clinic_id) REFERENCES public.owners (id, clinic_id) ON DELETE CASCADE;

ALTER TABLE public.visits
  ADD CONSTRAINT visits_pet_same_clinic_fkey
  FOREIGN KEY (pet_id, clinic_id) REFERENCES public.pets (id, clinic_id) ON DELETE CASCADE;
