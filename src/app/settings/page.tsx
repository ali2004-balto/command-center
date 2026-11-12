// /settings (owner): switches, views, health, TV link.
import { requireCapability } from '@/lib/auth/guards';
import { isMock } from '@/lib/env';
import { loadModel } from '@/lib/load';
import Nav from '@/components/Nav';
import SettingsView from '@/components/SettingsView';
import s from '@/components/Home.module.css';

export const dynamic = 'force-dynamic';

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability('change_switches');
  const { error } = await searchParams;
  const m = await loadModel();
  return (
    <main className={s.wrap}>
      <Nav model={m} />
      <h1>Settings</h1>
      <SettingsView m={m} error={error} liveMode={!isMock()} />
    </main>
  );
}
