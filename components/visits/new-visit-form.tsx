'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PrescriptionFields, type PrescriptionDraft } from '@/components/visits/prescription-fields';
import { supabase } from '@/lib/supabase';
import { SPECIES_OPTIONS, toLocalInputValue } from '@/lib/vet';

interface CreatedVisit {
  visit_id: string;
  access_token: string;
}

function isCreatedVisit(value: unknown): value is CreatedVisit {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CreatedVisit).visit_id === 'string' &&
    typeof (value as CreatedVisit).access_token === 'string'
  );
}

function createPrescriptionDraft(): PrescriptionDraft {
  const firstDose = new Date();
  firstDose.setMinutes(0, 0, 0);
  firstDose.setHours(firstDose.getHours() + 1);

  return {
    key: crypto.randomUUID(),
    medicationName: '',
    dose: '',
    frequencyPerDay: 2,
    durationDays: 7,
    firstDoseAt: toLocalInputValue(firstDose),
  };
}

function describeSaveError(message: string | undefined) {
  if (message?.includes('Подтвердите email')) return 'Подтвердите email, чтобы создавать визиты.';
  return 'Не удалось сохранить визит. Проверьте данные и попробуйте ещё раз.';
}

const inputGroupClassName = 'space-y-2';
const sectionClassName = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8';
const sectionTitleClassName = 'text-lg font-semibold text-slate-900';

export function NewVisitForm() {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<string>(SPECIES_OPTIONS[0].value);
  const [breed, setBreed] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPrescriptions([createPrescriptionDraft()]);
  }, []);

  function updatePrescription(key: string, patch: Partial<PrescriptionDraft>) {
    setPrescriptions((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function removePrescription(key: string) {
    setPrescriptions((current) => current.filter((item) => item.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (prescriptions.length === 0) {
      setError('Добавьте хотя бы один препарат');
      return;
    }

    setError(null);
    setSubmitting(true);

    const { data, error: rpcError } = await supabase.rpc('create_visit', {
      p_owner_name: ownerName.trim(),
      p_owner_phone: ownerPhone.trim(),
      p_pet_name: petName.trim(),
      p_species: species,
      p_breed: breed.trim(),
      p_weight_kg: weightKg ? Number(weightKg) : null,
      p_birth_date: birthDate || null,
      p_diagnosis: diagnosis.trim(),
      p_next_visit_date: nextVisitDate || null,
      p_notes: notes.trim(),
      p_prescriptions: prescriptions.map((item) => ({
        medication_name: item.medicationName.trim(),
        dose: item.dose.trim(),
        frequency_per_day: item.frequencyPerDay,
        duration_days: item.durationDays,
        first_dose_at: new Date(item.firstDoseAt).toISOString(),
      })),
    });

    if (rpcError || !isCreatedVisit(data)) {
      setError(describeSaveError(rpcError?.message));
      setSubmitting(false);
      return;
    }

    router.push(`/dashboard/visits/${data.visit_id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900">Новый визит</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Заполните данные и назначения. После сохранения владелец получит QR-код с планом приёма.
        </p>
      </div>

      <section className={sectionClassName}>
        <h2 className={sectionTitleClassName}>Владелец и питомец</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className={inputGroupClassName}>
            <Label htmlFor="owner-name">Имя владельца</Label>
            <Input id="owner-name" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="owner-phone">Телефон владельца</Label>
            <Input
              id="owner-phone"
              type="tel"
              required
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="+7 (900) 000-00-00"
            />
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="pet-name">Кличка питомца</Label>
            <Input id="pet-name" required value={petName} onChange={(e) => setPetName(e.target.value)} />
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="pet-species">Вид</Label>
            <select
              id="pet-species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SPECIES_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="pet-breed">Порода</Label>
            <Input id="pet-breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="pet-weight">Вес, кг</Label>
            <Input
              id="pet-weight"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="999.99"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="pet-birth">Дата рождения</Label>
            <Input id="pet-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
        </div>
      </section>

      <section className={sectionClassName}>
        <h2 className={sectionTitleClassName}>Визит</h2>
        <div className="mt-6 grid gap-5">
          <div className={inputGroupClassName}>
            <Label htmlFor="diagnosis">Диагноз</Label>
            <Input id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </div>
          <div className={inputGroupClassName}>
            <Label htmlFor="notes">Рекомендации</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className={`${inputGroupClassName} sm:max-w-xs`}>
            <Label htmlFor="next-visit">Следующий визит</Label>
            <Input
              id="next-visit"
              type="date"
              value={nextVisitDate}
              onChange={(e) => setNextVisitDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className={sectionClassName}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={sectionTitleClassName}>Назначения</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrescriptions((current) => [...current, createPrescriptionDraft()])}
            className="transition-colors hover:border-teal-300 hover:text-teal-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить препарат
          </Button>
        </div>
        <div className="mt-6 space-y-4">
          {prescriptions.map((draft, index) => (
            <PrescriptionFields
              key={draft.key}
              index={index}
              draft={draft}
              canRemove={prescriptions.length > 1}
              onChange={(patch) => updatePrescription(draft.key, patch)}
              onRemove={() => removePrescription(draft.key)}
            />
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 bg-teal-700 px-6 text-white transition-colors hover:bg-teal-800"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? 'Сохраняем...' : 'Сохранить и создать QR-код'}
        </Button>
      </div>
    </form>
  );
}
