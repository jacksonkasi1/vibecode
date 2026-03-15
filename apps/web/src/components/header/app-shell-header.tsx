// ** import core packages
import { CircleUser, Settings } from "lucide-react";
import { Link } from "react-router-dom";

// ** import components
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";

export function AppShellHeader() {
  return (
    <header className="mb-6 flex items-center justify-end gap-2">
      <ModeToggle />
      <Button variant="ghost" size="icon-xs" asChild>
        <Link to="/account/ai-model-settings" aria-label="AI model settings">
          <Settings className="h-3.5 w-3.5" />
          <span className="sr-only">AI model settings</span>
        </Link>
      </Button>
      <Button variant="ghost" size="icon-xs" asChild>
        <Link to="/account/settings" aria-label="Account settings">
          <CircleUser className="h-3.5 w-3.5" />
          <span className="sr-only">Account settings</span>
        </Link>
      </Button>
    </header>
  );
}
