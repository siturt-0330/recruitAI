'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CompanyPage } from '@/components/CompanyPage';
import { Empty } from '@/components/ui';
import { useStore } from '@/lib/store';

/** 会社のページを1ページ全体で開く（スマホ・「全画面で開く」） */
export default function CompanyFullPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const company = useStore((s) => s.companies.find((c) => c.id === id));

  if (!company) {
    return (
      <Empty
        title="企業が見つかりません"
        action={
          <Link href="/companies" className="font-bold text-link">
            マイページへ
          </Link>
        }
      />
    );
  }
  return <CompanyPage company={company} mode="full" onClose={() => router.push('/companies')} />;
}
