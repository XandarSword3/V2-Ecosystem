import { redirect } from 'next/navigation';

/**
 * The admin dashboard has been removed.
 *
 * The old dashboard hardcoded revenue aggregations to specific legacy module slugs,
 * making it wrong for any dynamic module setup. The revenueByUnit section was
 * the only part that was already module-aware, and it lives in the reports section now.
 *
 * All admin entry-points go through /[property]/admin/modules.
 * See CONTEXT.md Issue 3 for full rationale.
 */
export default async function AdminDashboardRedirect({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property } = await params;
  redirect(`/${property}/admin/modules`);
}
