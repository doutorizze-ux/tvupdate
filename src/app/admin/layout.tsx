
import { ReactNode } from 'react';
import { isAppInstalled, getGeneralSettings } from '@/lib/data.actions';
import { redirect } from 'next/navigation';
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell';
import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  // 1. Server-side check for installation
  const installed = await isAppInstalled();
  if (!installed) {
    redirect('/install');
  }

  const settings = await getGeneralSettings();

  // 2. Render with Firebase Provider for Auth compatibility
  return (
    <FirebaseClientProvider lang="en" settings={settings}>
        <AdminLayoutShell initialSettings={settings}>{children}</AdminLayoutShell>
        <Toaster />
    </FirebaseClientProvider>
  );
}
