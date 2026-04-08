'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FilterChip {
  id: string;
  label: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  className?: string;
}

export function FilterChips({
  chips,
  selectedIds,
  onToggle,
  className = '',
}: FilterChipsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip) => {
        const isSelected = selectedIds.includes(chip.id);
        return (
          <Badge
            key={chip.id}
            variant={isSelected ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer transition-all hover:scale-105',
              isSelected
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'hover:border-indigo-400 hover:text-indigo-600'
            )}
            onClick={() => onToggle(chip.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(chip.id);
              }
            }}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
          >
            {chip.label}
          </Badge>
        );
      })}
    </div>
  );
}
