"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Image from "next/image";
import { Bell, Menu, Search, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export function Header() {
  const { user } = useUser();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search trades..."
              className="w-64 pl-10"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3">
          {user?.picture ? (
            <Image
              src={user.picture}
              alt={user.name || "User"}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
          )}
          <Link href="/api/auth/logout">
            <Button variant="ghost" size="icon" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
