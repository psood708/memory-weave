import App from '@/components/App';

const VALID_TABS = ['conversation', 'evals', 'docs', 'files'] as const;
type Tab = typeof VALID_TABS[number];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: Tab = VALID_TABS.includes(tab as Tab) ? (tab as Tab) : 'conversation';
  return <App initialTab={initialTab} />;
}
