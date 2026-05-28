/** Админка читает данные из БД на запросе; не кэшируем при статической сборке. */
import { AdminDbBanner } from "@/components/crm/admin-db-banner";

export const dynamic = "force-dynamic";

export default async function AdminSegmentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AdminDbBanner />
      {children}
    </>
  );
}
