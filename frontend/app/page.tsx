import { redirect } from 'next/navigation';

// This page will redirect to /dashboard as configured in next.config.js
export default function HomePage() {
  redirect('/dashboard');
}
