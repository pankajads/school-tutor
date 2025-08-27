import type { Metadata } from 'next';
import { MUIProvider } from '../providers/MUIProvider';
import StudentNavigation from './components/StudentNavigation';

export const metadata: Metadata = {
  title: 'Student Portal - School Tutor AI',
  description: 'Personalized learning experience for students',
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MUIProvider>
      <div id="student-portal">
        <StudentNavigation />
        <main>
          {children}
        </main>
      </div>
    </MUIProvider>
  );
}
