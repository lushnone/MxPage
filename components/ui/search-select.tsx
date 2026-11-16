"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type SearchSelectOption = {
  value: string;
  label: string;
};

type SearchSelectProps = {
  id?: string;
  "aria-label"?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SearchSelectOption[];
  disabled?: boolean;
  emptyOptionLabel?: string;
  noMatchLabel?: string;
  searchPlaceholder?: string;
  className?: string;
};

function normalizeForSearch(text: string) {
  return text.trim().toLowerCase();
}

export function SearchSelect({
  id,
  "aria-label": ariaLabel,
  value,
  onValueChange,
  options,
  disabled,
  emptyOptionLabel = "未选择",
  noMatchLabel = "没有匹配的模型",
  searchPlaceholder = "搜索模型名称或 ID…",
  className,
}: SearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    const needle = normalizeForSearch(query);
    if (!needle) return options;
    return options.filter(option => {
      const haystack = `${option.label} ${option.value}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query]);

  const selectedLabel = React.useMemo(() => {
    if (!value) return emptyOptionLabel;
    return options.find(option => option.value === value)?.label ?? value;
  }, [emptyOptionLabel, options, value]);

  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };

  const listId = id ? `${id}-listbox` : undefined;

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0", className)}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(current => !current);
        }}
        className={cn(
          "group flex h-10 w-full min-w-0 select-none items-center justify-between gap-3 rounded-xl border border-input bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-[100] mt-1.5 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
          role="presentation"
        >
          <div className="border-b border-border/70 p-2">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`${ariaLabel ?? "模型"}搜索`}
                className="h-9 pl-8"
                onKeyDown={event => {
                  if (event.key === "Enter" && filteredOptions.length === 1) {
                    event.preventDefault();
                    choose(filteredOptions[0]!.value);
                  }
                }}
              />
            </div>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto p-1.5"
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                className={cn(
                  "relative flex min-h-9 w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  value === "" && "bg-secondary font-medium",
                )}
                onClick={() => choose("")}
              >
                <span className="break-all">{emptyOptionLabel}</span>
                {value === "" ? (
                  <Check className="absolute right-3 h-4 w-4" aria-hidden />
                ) : null}
              </button>
            </li>

            {filteredOptions.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground" role="presentation">
                {noMatchLabel}
              </li>
            ) : (
              filteredOptions.map(option => {
                const selected = option.value === value;
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "relative flex min-h-9 w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        selected && "bg-secondary font-medium",
                      )}
                      onClick={() => choose(option.value)}
                    >
                      <span className="break-all">{option.label}</span>
                      {selected ? (
                        <Check className="absolute right-3 h-4 w-4" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}