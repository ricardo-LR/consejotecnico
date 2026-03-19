import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CONSEJOTECNICO – Planeaciones Educativas',
  description: 'Plataforma de planeaciones educativas para docentes. Accede a cientos de planes de clase organizados por tema y grado.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}>
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
