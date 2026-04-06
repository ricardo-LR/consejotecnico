'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getPlanBadgeColor, getPlanLabel } from '@/utils/planValidation';

interface MaestroLayoutProps {
  children: React.ReactNode;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  planRequired?: string[];
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

export default function MaestroLayout({ children }: MaestroLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [planType, setPlanType] = useState('gratuito');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    setEmail(localStorage.getItem('email') ?? '');
    setPlanType(localStorage.getItem('plan_type') ?? 'gratuito');
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('plan_type');
    router.push('/');
  }

  const navLinks: NavLink[] = [
    {
      href: '/maestro/dashboard',
      label: 'Inicio',
      icon: <HomeIcon />,
    },
    {
      href: '/maestro/grupos',
      label: 'Mis Grupos',
      icon: <GroupIcon />,
    },
    {
      href: '/maestro/cte',
      label: 'CTE',
      icon: <BookIcon />,
      planRequired: ['pro_directivo'],
    },
    {
      href: '/maestro/diario',
      label: 'Diario de Clase',
      icon: <BookIcon />,
      planRequired: ['grado', 'pro', 'pro_maestro', 'pro_directivo'],
    },
    {
      href: '/maestro/recursos',
      label: 'Recursos',
      icon: <FolderIcon />,
      planRequired: ['grado', 'pro', 'pro_maestro', 'pro_directivo'],
    },
  ];

  const visibleLinks = navLinks.filter(
    (link) => !link.planRequired || link.planRequired.includes(planType)
  );

  // Also show locked links for gratuito so they can see what's available
  const allLinks = navLinks;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-30 flex flex-col transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <Link href="/" className="text-lg font-bold text-blue-600 hover:text-blue-700 block">
            CONSEJOTECNICO
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">Workspace Maestro</p>
        </div>

        {/* Plan badge */}
        <div className="px-5 py-3 border-b border-gray-100">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getPlanBadgeColor(planType)}`}
          >
            {getPlanLabel(planType)}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allLinks.map((link) => {
            const isLocked = link.planRequired && !link.planRequired.includes(planType);
            const isActive = pathname === link.href;
            if (isLocked) {
              return (
                <div
                  key={link.href}
                  title={`Requiere plan: ${link.planRequired?.join(' o ')}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed select-none"
                >
                  <span className="opacity-50">{link.icon}</span>
                  <span className="opacity-60">{link.label}</span>
                  <svg className="w-3.5 h-3.5 ml-auto text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Upgrade banner for gratuito */}
        {planType === 'gratuito' && (
          <div className="mx-3 mb-3 p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-1">Actualiza tu plan</p>
            <p className="text-xs text-blue-700 mb-2">Accede a diario, recursos y más grupos.</p>
            <Link
              href="/checkout?plan=grado"
              className="block w-full text-center bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ver planes
            </Link>
          </div>
        )}

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Right side: compras link + user avatar */}
          <div className="flex items-center gap-4 ml-auto">
            <Link
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold hidden sm:block"
            >
              Mis Compras
            </Link>
            <span className="text-sm text-gray-500 hidden sm:block">{email}</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {email ? email[0].toUpperCase() : 'M'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
