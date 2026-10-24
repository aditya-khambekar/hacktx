"use client";

import { useEffect, useRef } from "react";
import { formatUsd } from "./costs";
import { Close, Plus } from "./icons";
import type { ComparisonApartment } from "./types";

type AddApartmentDialogProps = {
  open: boolean;
  onClose: () => void;
  catalog: ComparisonApartment[];
  shortlistIds: Set<string>;
  onAdd: (apartment: ComparisonApartment) => void;
};

export function AddApartmentDialog({ open, onClose, catalog, shortlistIds, onAdd }: AddApartmentDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const available = catalog.filter((apartment) => !shortlistIds.has(apartment.id));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="add-apartment-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl bg-paper-raised p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="add-apartment-title" className="text-[20px]">
            Add another place
          </h2>
          <p className="mt-1 text-sm text-ink-soft">From the sample catalog. Live search arrives with the assistant backend.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-sage">
          <Close size={18} />
        </button>
      </div>
      {available.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-soft">Every sample apartment is already on your shortlist.</p>
      ) : (
        <ul className="divide-y divide-line">
          {available.map((apartment) => (
            <li key={apartment.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-medium">{apartment.name}</p>
                <p className="text-sm text-ink-soft">
                  {apartment.street} · {apartment.advertisedRent === null ? "Rent not published" : `${formatUsd(apartment.advertisedRent)} advertised`} ·{" "}
                  {apartment.walking?.formattedDuration ?? "?"} walk
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAdd(apartment)}
                className="flex h-[31px] shrink-0 items-center gap-1 rounded-full bg-clay px-3 text-[12px] font-semibold text-white hover:bg-clay-dark"
              >
                <Plus size={16} />
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
