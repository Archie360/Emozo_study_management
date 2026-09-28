"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

// Spec 63: Dashboard / Studies / Administration. Create Study and Study
// Types live inside the Studies page rather than the top nav.
const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/studies", label: "Studies" },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold text-gray-900">Study &amp; Task Manager</span>
          <nav className="flex gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin") ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Administration
              </Link>
            )}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {user.name} <span className="text-gray-400">({user.role})</span>
            </span>
            <button onClick={logout} className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
