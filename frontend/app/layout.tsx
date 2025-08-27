import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { MUIProvider } from './providers/MUIProvider';
import Navigation from './components/Navigation';
import ErrorLogger from './components/ErrorLogger';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'School Tutor Agent',
  description: 'AI-powered personalized learning assistant for students',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MUIProvider>
          <div id="root">
            <Navigation />
            <main>
              {children}
            </main>
            <ErrorLogger position="fixed" showInProduction={true} maxEntries={50} />
          </div>
        </MUIProvider>
      </body>
    </html>
  );
}
