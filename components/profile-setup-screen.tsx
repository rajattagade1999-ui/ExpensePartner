'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppContext } from '@/context/app-context'
import { setSecurityQuestion } from '@/lib/services/auth.service'
import { upsertProfile } from '@/lib/services/profile.service'
import { toast } from 'sonner'

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  'What city were you born in?',
  "What is your mother's maiden name?",
  'What was the name of your first school?',
  'What is your favorite book?',
]

export default function ProfileSetupScreen() {
  const [firstName, setFirstName] = useState('')
  const [securityQuestion, setSecurityQuestionValue] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const { pendingProfileSetup, setPendingProfileSetup, setUser, setNeedsProfileSetup } = useAppContext()
  
  const signUpUser = pendingProfileSetup?.user

  const handleSubmit = async () => {
    if (!firstName.trim()) {
      toast.error('Please enter your first name')
      return
    }
    if (!signUpUser) {
      toast.error('Something went wrong. Please try signing up again.')
      return
    }

    setIsLoading(true)

    try {
      // Update profile with first name
      const updatedUser = { ...signUpUser, name: firstName.trim() }
      const profileResult = await upsertProfile(updatedUser)
      
      if ('error' in profileResult) {
        console.error('[ProfileSetup] Profile upsert failed:', profileResult.error)
        toast.error(profileResult.error)
        return
      }

      // Set security question (optional - don't block if it fails)
      if (securityQuestion && securityAnswer.trim()) {
        const result = await setSecurityQuestion(securityQuestion, securityAnswer)
        if ('error' in result) {
          console.warn('[ProfileSetup] Security question failed:', result.error)
          // Don't block - let user continue without security question
          toast.warning('Security question could not be saved. You can set it later in settings.')
        }
      }

      toast.success('Profile complete!')
      setPendingProfileSetup(null) // Clear the profile setup state
      setNeedsProfileSetup(false) // Clear the needs profile setup flag
      setUser(updatedUser) // Set the user to proceed to room selection
    } catch (error) {
      console.error('[ProfileSetup] Error:', error)
      toast.error('Failed to save profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen px-6">
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/ExPartner%20Logo.png"
              alt="ExpensePartner"
              width={200}
              height={60}
              className="mb-2 w-40 sm:w-48 h-auto object-contain"
              priority
            />
            <p className="text-muted-foreground text-sm">Complete your profile to continue</p>
          </div>

          {/* Profile Setup Card */}
          <Card className="p-6 space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Welcome!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your name to get started. Security question is optional.
              </p>
            </div>

            <div className="space-y-4">
              {/* First Name */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Your Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your name (shown to roommates)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 px-3 mt-1.5"
                  autoComplete="given-name"
                  autoFocus
                />
              </div>

              {/* Security Question (Optional) */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Security Question <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestionValue(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select a question...</option>
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This will be used to recover your password if you forget it.
                </p>
              </div>

              {/* Security Answer */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Your Answer <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="Enter your answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="h-11 px-3 mt-1.5"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !firstName.trim()}
              className="w-full h-11 text-base"
            >
              {isLoading ? 'Saving...' : 'Continue'}
            </Button>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 py-3 border-t border-border">
        <p className="text-center text-xs">
          Developed by <span className="text-[#2d2d2d] font-medium">RT</span>
          <span className="text-emerald-500 font-medium">1999</span>
        </p>
      </div>
    </div>
  )
}
