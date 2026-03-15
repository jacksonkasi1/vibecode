// ** import types
import type { ReactNode } from "react";

// ** import lib
import { UserButton } from "@daveyplate/better-auth-ui";
import { ChevronLeft, Settings } from "lucide-react";
import { Link } from "react-router-dom";

// ** import components
import { VibeMark } from "@/components/vibe-ui";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="grid grid-cols-3 items-center border-b px-4 py-1.5 sm:px-6">
        <div className="justify-self-start">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link to="/apps" aria-label="Back to apps">
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="sr-only">Back to apps</span>
            </Link>
          </Button>
        </div>

        <Link
          to="/apps"
          className="justify-self-center flex items-center gap-1.5 transition-opacity hover:opacity-80"
        >
          <VibeMark className="h-4 w-4" />
          <span className="text-sm font-medium tracking-tight">vibe</span>
        </Link>

        <div className="justify-self-end flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link
              to="/account/ai-model-settings"
              aria-label="AI model settings"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="sr-only">AI model settings</span>
            </Link>
          </Button>
          <ModeToggle />
          <div className="scale-90">
            <UserButton size="icon" />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
