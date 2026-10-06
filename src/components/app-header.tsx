"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Pencil, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { logout } from "@/lib/auth/actions/logout";
import { DeleteAccountDialog, DisplayNameDialog } from "@/components/account-dialogs";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppHeaderProps = { displayName: string | null; email: string };

// The app shell's header (docs/app-shell.md, owned by PROJ-1): app name left, account menu right (AC-16).
export function AppHeader({ displayName, email }: AppHeaderProps) {
  const [nameOpen, setNameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loggingOut, startLogout] = useTransition();
  const shownName = displayName ?? email;

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href="/dashboard"
          aria-label="WattWann – zur Übersicht"
          className="rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="min-w-0 max-w-[60vw] sm:max-w-xs" aria-label={`Kontomenü von ${shownName}`}>
              <UserRound aria-hidden="true" />
              <span className="truncate">{shownName}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setNameOpen(true)}>
              <Pencil aria-hidden="true" />
              Anzeigename ändern
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/datenschutz">
                <ShieldCheck aria-hidden="true" />
                Datenschutz
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
              <Trash2 aria-hidden="true" />
              Konto löschen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={loggingOut} onSelect={() => startLogout(() => logout())}>
              <LogOut aria-hidden="true" />
              {loggingOut ? "Wird abgemeldet …" : "Abmelden"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DisplayNameDialog open={nameOpen} onOpenChange={setNameOpen} currentName={displayName} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </header>
  );
}
