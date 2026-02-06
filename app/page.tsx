'use client'

import AuthScreen from '@/components/auth-screen'
import ProfileSetupScreen from '@/components/profile-setup-screen'
import DashboardScreen from '@/components/dashboard-screen'
import { AppProvider, useAppContext } from '@/context/app-context'
import { signOut } from '@/lib/services/auth.service'

export default function Home() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-background">
        <MainRouter />
      </div>
    </AppProvider>
  )
}

function MainRouter() {
  const { user, room, authLoading, groupsLoading, setUser, setRoom, pendingProfileSetup, needsProfileSetup } = useAppContext()

  const handleLogout = () => {
    if (!user) return
    setUser(null)
    setRoom(null)
    signOut()
  }

  if (authLoading || (user && groupsLoading && !room && !pendingProfileSetup?.showDialog && !needsProfileSetup)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  // Show profile setup screen if user just signed up and needs to complete profile
  // This also handles the case where user refreshes before completing profile setup
  if (pendingProfileSetup?.showDialog || needsProfileSetup) {
    return <ProfileSetupScreen />
  }

  if (!user) {
    return <AuthScreen />
  }

  if (!room) {
    return <AuthScreen />
  }

  return <DashboardScreen onLogout={handleLogout} />
}
