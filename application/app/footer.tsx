import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 px-6 py-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
      <Link href="/privacy" className="hover:underline">
        Privacy policy
      </Link>
    </footer>
  );
}
