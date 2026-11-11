import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useSettingsStore } from '../../store/settingsStore'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'
import Card from '../../components/common/cards/Card'
import { Printer } from 'lucide-react'
import { printReport } from '../../utils/printReport'
import { mediaUrl } from '../../store/settingsStore'

interface Item {
  id: number
  name: string
  sku?: string | null
  barcode?: string | null
  current_stock: number
  total_stock?: number
  min_stock?: number
  category?: { name: string } | string
  warehouse_id?: number
  warehouse_name?: string
}

interface WarehouseOption {
  id: number
  name: string
  code?: string | null
}

export default function StocktakingPage() {
  const { restaurant } = useSettingsStore()
  const [started, setStarted] = useState(false)
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const { data, isLoading } = useQuery({
    queryKey: ['stocktake-products-all'],
    queryFn: async () => {
      const res = await api.get('/products?per_page=1000')
      return res.data
    },
  })
  const items: Item[] = (data?.data || [])
  const stockFor = (it: Item) => Number(it.total_stock ?? it.current_stock) || 0

  const { data: warehousesRes } = useQuery({
    queryKey: ['stocktake-warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses')
      return (res.data.warehouses || []) as WarehouseOption[]
    },
  })
  const warehouses = warehousesRes || []

  const filteredItems = useMemo(() => {
    if (!selectedWarehouse) return items
    return items.filter((it) => String(it.warehouse_id) === selectedWarehouse)
  }, [items, selectedWarehouse])

  const handlePrint = () => {
    const rows = filteredItems.map((it) => {
      const counted = counts[it.id] !== undefined && counts[it.id] !== '' ? Number(counts[it.id]) : stockFor(it)
      const diff = counted - stockFor(it)
      return [it.name, it.sku || '-', String(stockFor(it)), String(counted), String(diff)]
    })
    printReport({
      title: 'جرد المخزون',
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [
        { label: 'الحالة', value: started ? 'جارٍ الجرد' : 'لم يبدأ' },
        { label: 'المخزن', value: selectedWarehouse ? warehouses.find((w) => String(w.id) === selectedWarehouse)?.name || 'الكل' : 'الكل' },
      ],
      sections: [{
        title: 'منتجات المخزون',
        columns: [{ label: 'الصنف' }, { label: 'SKU' }, { label: 'الكمية (نظام)' }, { label: 'الكمية (فعلي)' }, { label: 'الفرق' }],
        rows,
      }],
      generatedAt: new Date(),
    })
  }

  const totalDiff = useMemo(() => filteredItems.reduce((s, it) => {
    const counted = counts[it.id] !== undefined && counts[it.id] !== '' ? Number(counts[it.id]) : stockFor(it)
    return s + (counted - stockFor(it))
  }, 0), [filteredItems, counts])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">جرد المخزون</h1>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex gap-2">
            {!started ? (
              <Button onClick={() => setStarted(true)}>بداية الجرد</Button>
            ) : (
              <Button variant="secondary" onClick={() => setStarted(false)}>إيقاف</Button>
            )}
            <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4" /> طباعة / PDF</Button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">المخزن / المتجر</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
            >
              <option value="">جميع المخازن والمتاجر</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}{w.code ? ` (${w.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <Card>
        {isLoading ? (
          <p className="text-center py-8 text-gray-500">جارٍ التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-start">الصنف</th>
                  <th className="px-3 py-2 text-start">SKU</th>
                  <th className="px-3 py-2 text-start">المخزن</th>
                  <th className="px-3 py-2 text-start">الكمية (نظام)</th>
                  <th className="px-3 py-2 text-start">الكمية (فعلي)</th>
                  <th className="px-3 py-2 text-start">الفرق</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">لا توجد منتجات في هذا المخزن</td></tr>
                ) : (
                  filteredItems.map((it) => {
                    const counted = counts[it.id] !== undefined && counts[it.id] !== '' ? Number(counts[it.id]) : stockFor(it)
                    const diff = counted - stockFor(it)
                    return (
                      <tr key={it.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2">{it.sku || '-'}</td>
                        <td className="px-3 py-2">{it.warehouse_name || '-'}</td>
                        <td className="px-3 py-2">{stockFor(it)}</td>
                        <td className="px-3 py-2">
                          {started ? (
                            <Input
                              type="number"
                              value={counts[it.id] ?? ''}
                              onChange={(e) => setCounts((c) => ({ ...c, [it.id]: e.target.value }))}
                              placeholder={String(stockFor(it))}
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>{diff}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                  <td className="px-3 py-2" colSpan={4}>إجمالي الفرق</td>
                  <td className="px-3 py-2">{totalDiff}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
