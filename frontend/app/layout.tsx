import './globals.css';
import { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import AppShell from './components/AppShell';
import { ToastProvider } from './components/ui/Toast';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata = {
  title: 'Nathan Inventario',
  description: 'Control de stock, variantes, kardex y reportes',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}