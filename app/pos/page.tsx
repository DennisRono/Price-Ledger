
import { POSClient } from '@/components/pos/pos-client'
import { getStores } from '@/lib/store-db'

export default async function POSPage() {
  const stores = await getStores()

  return <POSClient stores={stores} />
}