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
  sku?: string
  current_stock: number
  min_stock: number
  unit?: { abbreviation?: string }
}

export default function StocktakingPage() {
  const { restaurant } = useSettingsStore()
  const [started, setStarted] = useState(false)
  const [counts, setCounts] = useState<Record<number, string>>({})
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: async () => {
      const res = await api.get('/inventory-items?per_page=1000')
      return res.data
    },
  })
  const items: Item[] = data?.data || []

  const handlePrint = () => {
    const rows = items.map((it) => {
      const counted = counts[it.id] !== undefined && counts[it.id] !== '' ? Number(counts[it.id]) : it.current_stock
      const diff = counted - (Number(it.current_stock) || 0)
      return [it.name, it.sku || '-', String(it.current_stock), String(counted), String(diff)]
    })
    printReport({
      title: 'جرد المخزون',
      restaurant,
      logo: mediaUrl(restaurant?.logo),
      meta: [{ label: 'الحالة', value: started ? 'جارٍ الجرد' : 'لم يبدأ' }],
      sections: [{
        title: 'أصناف المخزون',
        columns: [{ label: 'الصنف' }, { label: 'SKU' }, { label: 'الكمية (نظام)' }, { label: 'الكمية (فعلي)' }, { label: 'الفرق' }],
        rows,
      }],
      generatedAt: new Date(),
    })
  }

  const totalDiff = useMemo(() => items.reduce((s, it) => {
    const counted = counts[it.id] !== undefined && counts[it.id] !== '' ? Number(counts[it.id]) : Number(it.current_stock) || 0
    return s + (counted - (Number(it.current_stock) || 0))
  }, 0), [items, counts])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">جرد المخزون</h1>
        <div className="flex gap-2">
          {!started ? (
            <Button onClick={() => setStarted(true)}>بداية الجرد</Button>
          ) : (
            <Button variant="secondary" onClick={() => setStarted(false)}>إيقاف</Button>
          )}
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4" /> طباعة / PDF</Button>
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
                  <th className="px-3 py-2 text-start">الكمية (نظام)</th>
                  <th className="px-3 py-2 text-start">الكمية (فعلي)</th>
                  <th className="px-3 py-2 text-start">الفرق</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const counted = counts[it.id] !== undefined && counts[it.id] !== '' ? Number(counts[it.id]) : (Number(it.current_stock) || 0)
                  const diff = counted - (Number(it.current_stock) || 0)
                  return (
                    <tr key={it.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2">{it.sku || '-'}</td>
                      <td className="px-3 py-2">{it.current_stock}</td>
                      <td className="px-3 py-2">
                        {started ? (
                          <Input
                            type="number"
                            value={counts[it.id] ?? ''}
                            onChange={(e) => setCounts((c) => ({ ...c, [it.id]: e.target.value }))}
                            placeholder={String(it.current_stock)}
                          />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>{diff}</td>
                    </tr>
                  )
                })}
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