import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import i18n, { setLanguage } from "@/i18n";

type RoleKey = "guest" | "admin" | "collaborator" | "user";

type StoredUser = {
  username?: string;
  email?: string;
  user_type?: string;
};

const ADMIN_HEADER_THEME = {
  headerClass: "bg-white border-slate-200 text-slate-900",
  brandColorClass: "text-slate-900",
  languageButtonClass:
    "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2",
  languageDividerClass: "border-slate-200",
};

export const Header = () => {
  const { t } = useTranslation();
  const current = i18n.language || "en";
  const other = current === "en" ? "mm" : "en";
  const [userName, setUserName] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<RoleKey>("guest");
  const [loggingOut, setLoggingOut] = React.useState(false);
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "";

  const resolveRole = React.useCallback((user: StoredUser | null): RoleKey => {
    if (!user) return "guest";

    const rawRole =
      (typeof user?.user_type === "string" && user.user_type) || null;

    if (typeof rawRole === "string" && rawRole.trim().length > 0) {
      const normalized = rawRole.trim().toLowerCase();
      if (["admin"].includes(normalized)) return "admin";
      if (["collaborator"].includes(normalized)) return "collaborator";
      if (["normal_user"].includes(normalized)) return "user";
      return "user";
    }

    return "user";
  }, []);

  const loadUserFromStorage = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const storedUser = window.localStorage.getItem("user");

    if (!storedUser) {
      setUserName(null);
      setUserRole("guest");
      return;
    }

    try {
      const parsed = JSON.parse(storedUser) as StoredUser;
      setUserRole(resolveRole(parsed));

      if (parsed?.username) {
        setUserName(parsed.username as string);
      } else if (parsed?.email) {
        setUserName(parsed.email as string);
      } else {
        setUserName(null);
      }
    } catch (error) {
      console.warn("Unable to parse stored user", error);
      setUserName(null);
      setUserRole("guest");
    }
  }, [resolveRole]);

  React.useEffect(() => {
    loadUserFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "user" || event.key === null) {
        loadUserFromStorage();
      }
    };

    const handleAuthChange = () => loadUserFromStorage();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("user-auth-changed", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("user-auth-changed", handleAuthChange);
    };
  }, [loadUserFromStorage]);

  const handleLogout = React.useCallback(async () => {
    if (typeof window === "undefined") return;

    if (!apiUrl) {
      toast.error("Logout service is unavailable. Please try again later.");
      return;
    }

    const token = window.localStorage.getItem("access_token");

    setLoggingOut(true);

    try {
      if (!token) {
        window.localStorage.removeItem("access_token");
        window.localStorage.removeItem("user");
        setUserName(null);
        setUserRole("guest");
        window.dispatchEvent(new Event("user-auth-changed"));
        navigate("/sign-in", { replace: true });
        toast.success("Signed out successfully.");
        return;
      }

      const response = await fetch(`${apiUrl}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await response
        .json()
        .catch(() => ({ is_success: response.ok }));

      if (!response.ok || data?.is_success === false) {
        const message = data?.msg || "Unable to log out. Please try again.";
        toast.error(message);
        return;
      }

      window.localStorage.removeItem("access_token");
      window.localStorage.removeItem("user");

      setUserName(null);
      setUserRole("guest");

      toast.success("Signed out successfully.");

      window.dispatchEvent(new Event("user-auth-changed"));
      navigate("/sign-in", { replace: true });
    } catch (error) {
      console.error("Logout error", error);
      toast.error("Network error. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }, [apiUrl, navigate]);

  const roleTheme = ADMIN_HEADER_THEME;

  const headerClasses = cn("w-full border-b shadow-sm", roleTheme.headerClass);
  const brandClasses = cn(
    "text-sm sm:text-base font-semibold tracking-tight truncate hidden md:block",
    roleTheme.brandColorClass
  );
  const languageButtonClasses = cn(
    "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none",
    roleTheme.languageButtonClass
  );
  const languageDividerClasses = cn(
    "pl-2 ml-2 border-l flex items-center",
    roleTheme.languageDividerClass
  );
  const roleAttribute = userRole;

  const roleLabel = React.useMemo(() => {
    if (userRole === "guest") return null;
    const translationKey = `roles.${userRole}`;
    const fallback =
      userRole === "admin"
        ? "Administrator"
        : userRole === "collaborator"
        ? "Coordinator"
        : "Explorer";
    return t(translationKey, { defaultValue: fallback });
  }, [t, userRole]);

  const primaryLinks = React.useMemo(() => {
    const links = [
      { to: "/", label: t("nav.home", { defaultValue: "Home" }) },
      {
        to: "/landmark-map",
        label: t("nav.map", { defaultValue: "Map" }),
      },
    ];

    if (userRole === "admin") {
      links.push({
        to: "/admin/dashboard",
        label: t("nav.dashboard", { defaultValue: "Dashboard" }),
      });
    }

    if (userRole === "collaborator") {
      links.push({
        to: "/collaborator/dashboard",
        label: t("nav.dashboard", { defaultValue: "Dashboard" }),
      });
    }

    return links;
  }, [t, userRole]);

  const avatarInitial = React.useMemo(() => {
    if (!userName) return "?";
    const trimmed = userName.trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  }, [userName]);

  return (
    <header className={headerClasses} data-user-role={roleAttribute}>
      <div className="mx-auto max-w-screen-xl flex h-14 items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <div className="h-8 w-8 rounded-md flex items-center justify-center bg-emerald-500/10 text-emerald-700 text-[10px] font-semibold shadow-sm select-none">
            <img src="/maubin_navigation.png" alt="Logo" className="h-6 w-6" />
          </div>
          <h1 className={brandClasses} aria-label={t("brand")}>
            {t("brand")}
          </h1>
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 items-center justify-center gap-5 text-sm font-medium text-slate-700"
        >
          {primaryLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-slate-600 transition-colors whitespace-nowrap hover:text-emerald-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav
          aria-label="User"
          className="flex items-center gap-2 flex-shrink-0 text-slate-700"
        >
          <div className="flex items-center gap-2">
            {userName ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      aria-label={t("greeting", { name: userName })}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                          {avatarInitial}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex flex-col gap-0.5 text-sm">
                      <span className="font-semibold leading-tight">
                        {userName}
                      </span>
                      {roleLabel ? (
                        <span className="text-xs text-muted-foreground">
                          {roleLabel}
                        </span>
                      ) : null}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        navigate("/profile");
                      }}
                    >
                      <UserRound className="size-4" />
                      {t("nav.profile", { defaultValue: "Profile" })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        handleLogout();
                      }}
                      disabled={loggingOut}
                      variant="destructive"
                    >
                      <LogOut className="size-4" />
                      {loggingOut
                        ? `${t("nav.logout", { defaultValue: "Logout" })}...`
                        : t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/sign-in">{t("nav.login")}</Link>
                </Button>
                <Button asChild>
                  <Link to="/sign-up">{t("nav.signup")}</Link>
                </Button>
              </>
            )}
          </div>
          <div className={languageDividerClasses}>
            <button
              type="button"
              onClick={() => setLanguage(other)}
              className={languageButtonClasses}
              aria-label={
                other === "en"
                  ? "Switch language to English"
                  : "ဘာသာစကားကို မြန်မာလို ပြောင်းရန်"
              }
            >
              {other.toUpperCase()}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
