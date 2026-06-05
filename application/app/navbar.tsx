"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  if (
    pathname === "/g" ||
    pathname === "/s" ||
    pathname.startsWith("/g/") ||
    pathname.startsWith("/s/")
  ) {
    return null;
  }

  return (
    <nav className="border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4 text-sm font-medium">
        <Link href="/ask" className="hover:underline">
          Ask
        </Link>
        <Link href="/give" className="hover:underline">
          Give
        </Link>
      </div>
    </nav>
  );
}
