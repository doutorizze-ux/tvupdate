import { redirect } from 'next/navigation';

export default function LicenseSettingsRedirectPage() {
  redirect('/admin/settings/general');
}
