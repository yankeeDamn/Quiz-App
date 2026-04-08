'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Sun, Moon, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AppSettings } from '@/lib/types';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

export function SettingsPanel({ settings, onUpdateSettings }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Quiz Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Appearance</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex-1"
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="flex-1"
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </Button>
            </div>
          </div>

          <Separator />

          {/* Font Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Font Size</Label>
            <Select
              value={settings.fontSize}
              onValueChange={(value) => {
                if (value) {
                  onUpdateSettings({ fontSize: value as 'small' | 'medium' | 'large' })
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Timer Visibility */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                {settings.timerVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Show Timer
              </Label>
              <p className="text-xs text-muted-foreground">
                Display countdown timer during quiz
              </p>
            </div>
            <Switch
              checked={settings.timerVisible}
              onCheckedChange={(checked) =>
                onUpdateSettings({ timerVisible: checked })
              }
            />
          </div>

          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                Sound Effects
              </Label>
              <p className="text-xs text-muted-foreground">
                Play sounds for actions
              </p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) =>
                onUpdateSettings({ soundEnabled: checked })
              }
            />
          </div>

          {/* Confirm Before Submit */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Confirm Before Submit</Label>
              <p className="text-xs text-muted-foreground">
                Show confirmation dialog
              </p>
            </div>
            <Switch
              checked={settings.confirmBeforeSubmit}
              onCheckedChange={(checked) =>
                onUpdateSettings({ confirmBeforeSubmit: checked })
              }
            />
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Compact Mode</Label>
              <p className="text-xs text-muted-foreground">
                Reduce spacing for more content
              </p>
            </div>
            <Switch
              checked={settings.compactMode}
              onCheckedChange={(checked) =>
                onUpdateSettings({ compactMode: checked })
              }
            />
          </div>

          <Separator />

          {/* Keyboard Shortcuts */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Keyboard Shortcuts</Label>
            <div className="rounded-lg border p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Question</span>
                <kbd className="px-2 py-0.5 rounded bg-muted">→</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Question</span>
                <kbd className="px-2 py-0.5 rounded bg-muted">←</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mark for Review</span>
                <kbd className="px-2 py-0.5 rounded bg-muted">M</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Select Answer</span>
                <kbd className="px-2 py-0.5 rounded bg-muted">A-D</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submit Quiz</span>
                <kbd className="px-2 py-0.5 rounded bg-muted">Ctrl+Enter</kbd>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
