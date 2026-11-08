import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useAuthStore } from '../../store/authStore'
import { Store, Lock, User, Eye, EyeOff } from 'lucide-react'
import Button from '../../components/common/buttons/Button'
import Input from '../../components/common/inputs/Input'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (error: unknown) {
      const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined
      setError(message || 'حدث خطأ في تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary to-accent p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scarlet Store</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">نظام سكارلت لإدارة المبيعات والمخازن</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="اسم المستخدم"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            icon={<User className="w-5 h-5" />}
            required
          />

          <Input
            label="كلمة المرور"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock className="w-5 h-5" />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            }
            required
          />

          <Button
            type="submit"
            className="w-full"
            loading={loading}
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </Button>
        </form>
      </div>
    </div>
  )
}
