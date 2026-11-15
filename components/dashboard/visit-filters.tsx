'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export type VisitFilter = 'all' | 'attention' | 'in_progress';

const FILTERS: { value: VisitFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'attention', label: 'Требует внимания' },
  { value: 'in_progress', label: 'В процессе' },
];

interface VisitFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: VisitFilter;
  onFilterChange: (value: VisitFilter) => void;
}

export function VisitFilters({ query, onQueryChange, filter, onFilterChange }: VisitFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Кличка или телефон владельца"
          aria-label="Поиск визитов"
          className="h-11 bg-white pl-9"
        />
      </div>

      <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 sm:w-auto">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(option.value)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
