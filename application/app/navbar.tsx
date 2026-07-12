"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { stripAppBasePath } from "@/lib/paths";

export default function Navbar() {
  const pathname = usePathname();
  const normalizedPathname = stripAppBasePath(pathname);

  if (
    normalizedPathname === "/g" ||
    normalizedPathname === "/s" ||
    normalizedPathname.startsWith("/g/") ||
    normalizedPathname.startsWith("/s/")
  ) {
    return null;
  }

  return (
    <nav className="border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4 text-sm font-medium">
        <a href="/" className="hover:underline">
          Home
        </a>
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
