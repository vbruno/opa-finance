import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme/ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
