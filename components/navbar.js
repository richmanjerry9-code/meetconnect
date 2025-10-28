import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-md">
      {/* Logo */}
      <Link href="/" className="text-xl font-bold text-blue-600">
        MeetConnect
      </Link>

      {/* Navigation Links */}
      <div className="space-x-6">
        <Link href="/" className="text-gray-700 hover:text-blue-600">
          Home
        </Link>
        <Link href="/profiles" className="text-gray-700 hover:text-blue-600">
          Profiles
        </Link>
        <Link href="/terms" className="text-gray-700 hover:text-blue-600">
          Terms
        </Link>
        <Link href="/privacy" className="text-gray-700 hover:text-blue-600">
          Privacy
        </Link>
      </div>
    </nav>
  );
}
