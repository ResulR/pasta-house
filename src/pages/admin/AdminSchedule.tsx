import { useEffect, useState } from 'react';
import type { DaySchedule, ExceptionalClosure, ScheduleOverride } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { adminFetch } from '@/lib/adminCsrf';

const DAY_LABELS: Record<string, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};

interface AdminScheduleResponse {
  ok: boolean;
  data?: {
    schedule: DaySchedule[];
    closures: ExceptionalClosure[];
    overrides: ScheduleOverride[];
  };
  message?: string;
  error?: string;
}

interface UpdateOpeningHoursResponse {
  ok: boolean;
  data?: {
    schedule: DaySchedule[];
  };
  message?: string;
  error?: string;
}

interface CreateClosureResponse {
  ok: boolean;
  data?: ExceptionalClosure;
  message?: string;
  error?: string;
}

interface DeleteClosureResponse {
  ok: boolean;
  data?: {
    id: string;
  };
  message?: string;
  error?: string;
}

interface CreateOverrideResponse {
  ok: boolean;
  data?: ScheduleOverride;
  message?: string;
  error?: string;
}

interface DeleteOverrideResponse {
  ok: boolean;
  data?: {
    id: string;
  };
  message?: string;
  error?: string;
}

export default function AdminSchedule() {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [closures, setClosures] = useState<ExceptionalClosure[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [newClosureDate, setNewClosureDate] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');
  const [newOverrideDate, setNewOverrideDate] = useState('');
  const [newOverrideIsClosed, setNewOverrideIsClosed] = useState(false);
  const [newOverrideOpenTime, setNewOverrideOpenTime] = useState('18:00');
  const [newOverrideCloseTime, setNewOverrideCloseTime] = useState('23:00');
  const [newOverrideReason, setNewOverrideReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [creatingClosure, setCreatingClosure] = useState(false);
  const [creatingOverride, setCreatingOverride] = useState(false);
  const [deletingClosureId, setDeletingClosureId] = useState<string | null>(null);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);

  const fetchAdminSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/schedule', {
        method: 'GET',
        credentials: 'include',
      });

      const data: AdminScheduleResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de charger les horaires.');
        return;
      }

      setSchedule(data.data.schedule);
      setClosures(data.data.closures);
      setOverrides(data.data.overrides);
    } catch (err) {
      console.error('Admin schedule fetch error:', err);
      setError('Impossible de charger les horaires.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminSchedule();
  }, []);

  const updateDay = (day: string, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
  };

  const saveSchedule = async () => {
    try {
      setSavingSchedule(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch('/api/admin/schedule/opening-hours', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ schedule }),
      });

      const data: UpdateOpeningHoursResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de sauvegarder les horaires.');
        return;
      }

      setSchedule(data.data.schedule);
      setSuccessMessage(data.message || 'Horaires mis à jour avec succès.');
    } catch (err) {
      console.error('Admin schedule save error:', err);
      setError('Impossible de sauvegarder les horaires.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const addClosure = async () => {
    if (!newClosureDate) {
      setError('La date de fermeture est obligatoire.');
      return;
    }

    try {
      setCreatingClosure(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch('/api/admin/schedule/closures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          date: newClosureDate,
          reason: newClosureReason,
        }),
      });

      const data: CreateClosureResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de créer la fermeture exceptionnelle.');
        return;
      }

      setClosures((prev) => [...prev, data.data!]);
      setNewClosureDate('');
      setNewClosureReason('');
      setSuccessMessage(data.message || 'Fermeture exceptionnelle créée avec succès.');
    } catch (err) {
      console.error('Admin create closure error:', err);
      setError('Impossible de créer la fermeture exceptionnelle.');
    } finally {
      setCreatingClosure(false);
    }
  };

    const addOverride = async () => {
    if (!newOverrideDate) {
      setError("La date d'override est obligatoire.");
      return;
    }

    if (!newOverrideIsClosed && (!newOverrideOpenTime || !newOverrideCloseTime)) {
      setError("Les heures sont obligatoires si l'override n'est pas fermé.");
      return;
    }

    try {
      setCreatingOverride(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch('/api/admin/schedule/overrides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          date: newOverrideDate,
          isClosed: newOverrideIsClosed,
          openTime: newOverrideOpenTime,
          closeTime: newOverrideCloseTime,
          reason: newOverrideReason,
        }),
      });

      const data: CreateOverrideResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || "Impossible d'enregistrer l'override.");
        return;
      }

      setOverrides((prev) => {
        const withoutSameDate = prev.filter((item) => item.date !== data.data!.date);
        return [...withoutSameDate, data.data!].sort((a, b) => a.date.localeCompare(b.date));
      });

      setNewOverrideDate('');
      setNewOverrideIsClosed(false);
      setNewOverrideOpenTime('18:00');
      setNewOverrideCloseTime('23:00');
      setNewOverrideReason('');
      setSuccessMessage(data.message || 'Override de planning enregistré avec succès.');
    } catch (err) {
      console.error('Admin create override error:', err);
      setError("Impossible d'enregistrer l'override.");
    } finally {
      setCreatingOverride(false);
    }
  };

  const deleteClosure = async (closure: ExceptionalClosure) => {
    const confirmed = window.confirm(
      `Supprimer la fermeture exceptionnelle du ${closure.date} ?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingClosureId(closure.id);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/schedule/closures/${closure.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: DeleteClosureResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de supprimer la fermeture exceptionnelle.');
        return;
      }

      setClosures((prev) => prev.filter((item) => item.id !== closure.id));
      setSuccessMessage(data.message || 'Fermeture exceptionnelle supprimée avec succès.');
    } catch (err) {
      console.error('Admin delete closure error:', err);
      setError('Impossible de supprimer la fermeture exceptionnelle.');
    } finally {
      setDeletingClosureId(null);
    }
  };

    const deleteOverride = async (override: ScheduleOverride) => {
    const confirmed = window.confirm(
      `Supprimer l'override du ${override.date} ?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingOverrideId(override.id);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/schedule/overrides/${override.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: DeleteOverrideResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || "Impossible de supprimer l'override.");
        return;
      }

      setOverrides((prev) => prev.filter((item) => item.id !== override.id));
      setSuccessMessage(data.message || 'Override de planning supprimé avec succès.');
    } catch (err) {
      console.error('Admin delete override error:', err);
      setError("Impossible de supprimer l'override.");
    } finally {
      setDeletingOverrideId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="font-display text-xl font-bold">Horaires</h2>
        <p className="text-sm text-muted-foreground mt-6">Chargement des horaires...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Horaires</h2>

      <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-muted-foreground">
          Gérez les horaires hebdomadaires du restaurant. Les fermetures exceptionnelles sont branchées au backend.
        </p>

        <Button onClick={saveSchedule} disabled={savingSchedule || schedule.length === 0}>
          {savingSchedule ? 'Enregistrement...' : 'Sauvegarder les horaires'}
        </Button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!error && successMessage && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <p className="text-sm text-primary">{successMessage}</p>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {schedule.map((day) => (
          <div key={day.day} className="card-premium p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-[120px]">
                <button
                  onClick={() => updateDay(day.day, 'open', !day.open)}
                  className={`h-5 w-5 rounded border transition-colors ${
                    day.open ? 'bg-primary border-primary' : 'border-border'
                  }`}
                />
                <span className={`font-medium ${!day.open ? 'text-muted-foreground line-through' : ''}`}>
                  {DAY_LABELS[day.day]}
                </span>
              </div>

              {day.open && (
                <div className="flex items-center gap-2 text-sm">
                  <Input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => updateDay(day.day, 'openTime', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => updateDay(day.day, 'closeTime', e.target.value)}
                    className="w-28"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg font-semibold mt-8">Fermetures exceptionnelles</h3>

      <div className="mt-4 flex gap-2 flex-wrap">
        <Input
          type="date"
          value={newClosureDate}
          onChange={(e) => setNewClosureDate(e.target.value)}
          className="w-44"
        />
        <Input
          placeholder="Raison (optionnel)"
          value={newClosureReason}
          onChange={(e) => setNewClosureReason(e.target.value)}
          className="w-48"
        />
        <Button size="sm" onClick={addClosure} disabled={creatingClosure}>
          {creatingClosure ? 'Ajout...' : 'Ajouter'}
        </Button>
      </div>

      {closures.length > 0 && (
        <div className="mt-4 space-y-2">
          {closures.map((c) => (
            <div key={c.id} className="card-premium p-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{c.date}</span>
                {c.reason && <span className="text-muted-foreground ml-2">— {c.reason}</span>}
              </div>
              <button
                onClick={() => deleteClosure(c)}
                disabled={deletingClosureId === c.id}
                className="text-destructive/70 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <h3 className="font-display text-lg font-semibold mt-8">Overrides de planning</h3>

      <div className="mt-4 flex gap-2 flex-wrap items-end">
        <Input
          type="date"
          value={newOverrideDate}
          onChange={(e) => setNewOverrideDate(e.target.value)}
          className="w-44"
        />

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={newOverrideIsClosed}
            onChange={(e) => setNewOverrideIsClosed(e.target.checked)}
          />
          Jour fermé
        </label>

        {!newOverrideIsClosed && (
          <>
            <Input
              type="time"
              value={newOverrideOpenTime}
              onChange={(e) => setNewOverrideOpenTime(e.target.value)}
              className="w-32"
            />
            <Input
              type="time"
              value={newOverrideCloseTime}
              onChange={(e) => setNewOverrideCloseTime(e.target.value)}
              className="w-32"
            />
          </>
        )}

        <Input
          placeholder="Raison (optionnel)"
          value={newOverrideReason}
          onChange={(e) => setNewOverrideReason(e.target.value)}
          className="w-52"
        />

        <Button size="sm" onClick={addOverride} disabled={creatingOverride}>
          {creatingOverride ? 'Ajout...' : 'Ajouter un override'}
        </Button>
      </div>

      {overrides.length > 0 ? (
        <div className="mt-4 space-y-2">
          {overrides.map((override) => (
            <div key={override.id} className="card-premium p-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{override.date}</span>
                <span className="text-muted-foreground ml-2">
                  — {override.isClosed ? 'Fermé' : `${override.openTime} → ${override.closeTime}`}
                </span>
                {override.reason && (
                  <span className="text-muted-foreground ml-2">— {override.reason}</span>
                )}
              </div>

              <button
                onClick={() => deleteOverride(override)}
                disabled={deletingOverrideId === override.id}
                className="text-destructive/70 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-4">
          Aucun override de planning.
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Les horaires hebdomadaires, les fermetures exceptionnelles et les overrides sont branchés au backend.
      </p>
    </div>
  );
}