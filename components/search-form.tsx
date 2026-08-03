import { searchUser } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  /** "hero" is the landing page; "compact" sits in the profile page header. */
  variant?: "hero" | "compact";
  defaultValue?: string;
  className?: string;
};

export function SearchForm({
  variant = "hero",
  defaultValue,
  className,
}: SearchFormProps) {
  const isHero = variant === "hero";

  return (
    <form
      action={searchUser}
      className={cn("flex w-full gap-2", isHero && "flex-col sm:flex-row", className)}
    >
      <label htmlFor="username" className="sr-only">
        GitHub username
      </label>
      <Input
        id="username"
        name="username"
        type="text"
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={defaultValue}
        placeholder="GitHub username"
        aria-describedby={isHero ? "search-hint" : undefined}
        className={cn(
          "font-mono",
          isHero ? "h-12 text-base sm:flex-1" : "h-9 w-40 text-sm sm:w-56",
        )}
      />
      <Button type="submit" size={isHero ? "lg" : "sm"} className={isHero ? "h-12" : "h-9"}>
        Search
      </Button>
    </form>
  );
}
