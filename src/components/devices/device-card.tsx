"use client";

import { useId } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RecommendationText } from "@/lib/devices/recommendation-text";
import { formatDuration } from "@/lib/devices/schemas";
import type { Device } from "@/lib/devices/types";

import { RecommendationBlock } from "./recommendation-block";

type DeviceCardProps = {
  device: Device;
  /** null while prices are not there yet → skeleton line */
  recommendation: RecommendationText | null;
  onEdit: () => void;
  onDelete: () => void;
};

// One device card (design.md → "Gerätekarte (DeviceCard)"): name, run time, actions menu, recommendation.
// The name is always plain text (EC-12) and breaks anywhere, so 40 characters fit at 360 px (EC-13).
export function DeviceCard({ device, recommendation, onEdit, onDelete }: DeviceCardProps) {
  const { name, durationMinutes } = device;
  const headingId = useId();

  return (
    <Card className="p-5 shadow-none">
      <article aria-labelledby={headingId} className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 id={headingId} className="font-semibold break-words [overflow-wrap:anywhere]">{name}</h3>
            <p className="text-sm text-muted-foreground tabular-nums">{formatDuration(durationMinutes)} h</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-2 shrink-0" aria-label={`Aktionen für ${name}`}>
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden="true" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 aria-hidden="true" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <RecommendationBlock text={recommendation} />
      </article>
    </Card>
  );
}
