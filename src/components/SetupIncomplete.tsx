// Shown instead of any page when a required environment variable is missing. Shows no data.
export default function SetupIncomplete({ missing }: { missing: string[] }) {
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
      <h1>Setup incomplete</h1>
      {missing.map((m) => (
        <p key={m}>Setup incomplete: missing {m}</p>
      ))}
      <p>Add the missing settings in Vercel (Project, Settings, Environment Variables), then redeploy.</p>
    </main>
  );
}
