/*
# Restrict table privileges to least privilege

Plain-English summary
- New tables were automatically given full read/write access to the public (anonymous) role and to signed-in users.
- This migration removes all of that and grants only what the app needs.

1. Modified Tables
- clinics, owners, pets, visits, prescriptions, reminders: all privileges revoked from anon and authenticated.

2. Security
- Signed-in clinic staff: SELECT on patient tables (access is still limited to their own clinic by row policies); INSERT and SELECT on clinics (own row only).
- Anonymous visitors: no direct table access at all. They use the token-gated functions only.
- Patient writes happen only through the create_visit function.

3. Important notes
- Idempotent: REVOKE and GRANT can be re-run safely.
- No data is changed.
*/

REVOKE ALL ON public.clinics, public.owners, public.pets, public.visits, public.prescriptions, public.reminders FROM anon, authenticated;

GRANT SELECT, INSERT ON public.clinics TO authenticated;
GRANT SELECT ON public.owners, public.pets, public.visits, public.prescriptions, public.reminders TO authenticated;
