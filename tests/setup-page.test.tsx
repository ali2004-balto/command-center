// The "Setup incomplete" page names the missing variable and shows no data.
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import SetupIncomplete from '@/components/SetupIncomplete';

it('renders "Setup incomplete: missing X"', () => {
  const html = renderToStaticMarkup(<SetupIncomplete missing={['BRIDGE_SECRET']} />);
  expect(html).toContain('Setup incomplete: missing BRIDGE_SECRET');
  expect(html).not.toMatch(/Needs you|Today/);
});
