import { useEffect, useRef, useState } from 'react'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // محاولة التشغيل التلقائي مع الصوت
    const tryPlay = async () => {
      try {
        await video.play()
        setStarted(true)
      } catch {
        // المتصفح منع التشغيل التلقائي مع الصوت، جرب بدون صوت
        video.muted = true
        try {
          await video.play()
          setStarted(true)
        } catch {
          // حتى بدون صوت منع، نفترض بدأ التشغيل وننهي بعد الوقت المحدد
          setStarted(true)
        }
      }
    }

    tryPlay()

    const handleEnded = () => {
      onFinish()
    }

    video.addEventListener('ended', handleEnded)

    // timer أمان 9 ثوانٍ لضمان الانتهاء حتى لو تعطل الفيديو
    const timer = window.setTimeout(() => {
      onFinish()
    }, 9000)

    return () => {
      video.removeEventListener('ended', handleEnded)
      window.clearTimeout(timer)
    }
  }, [onFinish])

  // إذا لم يبدأ التشغيل بعد مهلة قصيرة، انتقل على أي حال
  useEffect(() => {
    if (!started) {
      const timer = window.setTimeout(() => {
        onFinish()
      }, 1000)
      return () => window.clearTimeout(timer)
    }
  }, [started, onFinish])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-black">
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          preload="auto"
          poster="/scarlet.png"
        >
          <source src="/scarlet%20splash.mp4" type="video/mp4" />
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 backdrop-blur bg-white/60 dark:bg-black/60 px-3 py-1 rounded">
          Scarlet Store
        </div>
      </div>
    </div>
  )
}
