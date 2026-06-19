import { getStores } from '@/lib/store-db'
import { CatalogApp } from '@/components/catalog-app'
import { Toaster } from '@/components/ui/sonner'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const stores = await getStores()

  return (
    <>
      <CatalogApp initialStores={stores} />
      <Toaster position="top-center" />
    </>
  )
}
