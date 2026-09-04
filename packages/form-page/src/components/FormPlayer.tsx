import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Form, QuestionConfig, Json } from '../types'
import { getTheme, getThemeCSSVariables } from '../themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from './ui/Progress'
import { Button } from './ui/Button'
import { ChevronUp, ChevronDown, Check, ArrowRight } from 'lucide-react'
import { QuestionRenderer } from './QuestionRenderer'
import { generateAvatar } from '../utils/avatar'

interface FormPlayerProps {
  form: Form
  ageRecipient: string
  onSubmit: (answers: Record<string, Json>) => Promise<void>
}

export function FormPlayer({ form, ageRecipient, onSubmit }: FormPlayerProps) {
  const questions = (form.questions as QuestionConfig[]) || []
  const theme = getTheme(form.theme)
  const themeStyles = getThemeCSSVariables(theme)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Json>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [direction, setDirection] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const skipNextValidationRef = useRef(false)

  const avatarData = useMemo(() => ageRecipient ? generateAvatar(ageRecipient) : null, [ageRecipient])

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const isFirstQuestion = currentIndex === 0
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0

  const validateCurrentQuestion = useCallback(() => {
    if (!currentQuestion) return true

    const answer = answers[currentQuestion.id]

    if (currentQuestion.required) {
      if (answer === undefined || answer === null || answer === '') {
        setErrors({ ...errors, [currentQuestion.id]: 'This field is required' })
        return false
      }

      if (Array.isArray(answer) && answer.length === 0) {
        setErrors({ ...errors, [currentQuestion.id]: 'Please select at least one option' })
        return false
      }
    }

    if (answer && currentQuestion.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(answer))) {
        setErrors({ ...errors, [currentQuestion.id]: 'Please enter a valid email address' })
        return false
      }
    }

    if (answer && currentQuestion.type === 'url') {
      try {
        new URL(String(answer))
      } catch {
        setErrors({ ...errors, [currentQuestion.id]: 'Please enter a valid URL' })
        return false
      }
    }

    if (answer && currentQuestion.type === 'phone') {
      const phoneRegex = /^[+]?[\d\s\-().]+$/
      if (!phoneRegex.test(String(answer))) {
        setErrors({ ...errors, [currentQuestion.id]: 'Please enter a valid phone number' })
        return false
      }
    }

    const newErrors = { ...errors }
    delete newErrors[currentQuestion.id]
    setErrors(newErrors)
    return true
  }, [currentQuestion, answers, errors])

  const goToNext = useCallback(
    (skipValidation?: boolean) => {
      const shouldSkip = skipValidation || skipNextValidationRef.current
      skipNextValidationRef.current = false

      if (!shouldSkip && !validateCurrentQuestion()) return

      if (isLastQuestion) {
        handleSubmit()
      } else {
        setDirection(1)
        setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))
      }
    },
    [isLastQuestion, questions.length, validateCurrentQuestion],
  )

  const goToPrevious = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleSubmit = async () => {
    if (!validateCurrentQuestion()) return
    setIsSubmitting(true)
    try {
      await onSubmit(answers)
      setIsSubmitted(true)
    } catch {
      setErrors({ ...errors, _submit: 'Submission failed. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateAnswer = (questionId: string, value: Json) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    if (errors[questionId]) {
      const newErrors = { ...errors }
      delete newErrors[questionId]
      setErrors(newErrors)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitted || isSubmitting) return

      if (e.key === 'Enter' && !e.shiftKey) {
        if (currentQuestion?.type === 'long_text') {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            goToNext()
          }
          return
        }
        e.preventDefault()
        goToNext()
      }

      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        goToPrevious()
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentQuestion, goToNext, goToPrevious, isSubmitted, isSubmitting])

  useEffect(() => {
    let lastScrollTime = 0
    const scrollThreshold = 500
    const deltaThreshold = 50

    const handleWheel = (e: WheelEvent) => {
      if (isSubmitted || isSubmitting) return

      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA') return

      const now = Date.now()
      if (now - lastScrollTime < scrollThreshold) return
      if (Math.abs(e.deltaY) < deltaThreshold) return

      if (e.deltaY > 0) {
        goToNext()
      } else {
        goToPrevious()
      }

      lastScrollTime = now
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [goToNext, goToPrevious, isSubmitted, isSubmitting])

  if (isSubmitted) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center p-6"
        style={{
          ...themeStyles,
          backgroundColor: theme.backgroundColor,
          fontFamily: theme.fontFamily,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            <Check className="w-10 h-10" style={{ color: theme.primaryColor }} />
          </motion.div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: theme.textColor }}
          >
            {form.thank_you_message}
          </h1>
          <p className="text-lg opacity-70" style={{ color: theme.textColor }}>
            Your response has been recorded.
          </p>
        </motion.div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center p-6"
        style={{
          backgroundColor: theme.backgroundColor,
          fontFamily: theme.fontFamily,
        }}
      >
        <p style={{ color: theme.textColor }} className="opacity-50">
          This form has no questions yet.
        </p>
      </div>
    )
  }

  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      y: direction > 0 ? -100 : 100,
      opacity: 0,
    }),
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-dvh"
      style={{
        ...themeStyles,
        backgroundColor: theme.backgroundColor,
        fontFamily: theme.fontFamily,
      }}
    >
      <div className="fixed top-0 left-0 right-0 z-50">
        <Progress
          value={progress}
          className="h-1 rounded-none"
          indicatorStyle={{
            backgroundColor: theme.primaryColor,
          }}
        />
      </div>

      {avatarData && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 group flex flex-col items-center gap-1"
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: `${theme.primaryColor}15`,
              border: `1px solid ${theme.primaryColor}30`,
            }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.primaryColor }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: theme.primaryColor }}>
              E2EE
            </span>
            <span className="text-[11px] opacity-40" style={{ color: theme.primaryColor }}>·</span>
            <div
              className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"
              dangerouslySetInnerHTML={{ __html: avatarData.svg }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: theme.primaryColor }}
            >
              {avatarData.slug}
            </span>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
            style={{
              backgroundColor: theme.backgroundColor,
              color: theme.textColor,
              border: `1px solid ${theme.primaryColor}30`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {ageRecipient}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col p-6 pt-12 pb-24 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 flex items-center gap-2"
              >
                <span
                  className="text-base font-medium"
                  style={{ color: theme.primaryColor }}
                >
                  {currentIndex + 1}
                </span>
                <ArrowRight className="w-4 h-4" style={{ color: theme.primaryColor }} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3"
                style={{ color: theme.textColor }}
              >
                {currentQuestion.title || 'Untitled question'}
                {currentQuestion.required && (
                  <span style={{ color: theme.primaryColor }} className="ml-1">
                    *
                  </span>
                )}
              </motion.h2>

              {currentQuestion.description && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg md:text-xl opacity-70 mb-8"
                  style={{ color: theme.textColor }}
                >
                  {currentQuestion.description}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-8"
              >
                <QuestionRenderer
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={(value) => updateAnswer(currentQuestion.id, value)}
                  theme={theme}
                  error={errors[currentQuestion.id]}
                  onSubmit={(skipValidation?: boolean) => {
                    if (skipValidation) {
                      skipNextValidationRef.current = true
                    }
                    goToNext(skipValidation)
                  }}
                  onClearError={() => {
                    if (errors[currentQuestion.id]) {
                      const newErrors = { ...errors }
                      delete newErrors[currentQuestion.id]
                      setErrors(newErrors)
                    }
                  }}
                />
              </motion.div>

              <AnimatePresence>
                {errors[currentQuestion.id] && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 text-sm font-medium"
                    style={{ color: '#EF4444' }}
                  >
                    {errors[currentQuestion.id]}
                  </motion.p>
                )}
              </AnimatePresence>

              {errors._submit && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-sm font-medium"
                  style={{ color: '#EF4444' }}
                >
                  {errors._submit}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 flex items-center gap-4"
              >
                <Button
                  onClick={() => goToNext()}
                  disabled={isSubmitting}
                  className="h-12 px-6 text-base font-medium"
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.backgroundColor,
                  }}
                >
                  {isSubmitting ? (
                    'Submitting...'
                  ) : isLastQuestion ? (
                    <>
                      Submit
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      OK
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <span
                  className="text-sm opacity-50"
                  style={{ color: theme.textColor }}
                >
                  press <kbd className="font-mono font-medium">Enter ↵</kbd>
                </span>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            disabled={isFirstQuestion}
            className="h-10 w-10 p-0"
            style={{ color: theme.textColor }}
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToNext()}
            disabled={isSubmitting}
            className="h-10 w-10 p-0"
            style={{ color: theme.textColor }}
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
