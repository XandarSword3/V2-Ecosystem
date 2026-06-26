import { redirect } from 'next/navigation';

export default async function UsersIndex({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property } = await params;
  redirect(`/${property}/admin/users/customers`);
}
