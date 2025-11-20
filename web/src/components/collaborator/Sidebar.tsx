import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

interface UserProfile {
  username: string;
  email: string;
  user_type: string;
  avatar?: string;
}

interface NavItem {
  id: string;
  label: string;
  count: number;
}

interface NavCategory {
  category: string;
  items: NavItem[];
}

interface SidebarProps {
  activePanel?: string;
  onPanelChange?: (panel: string) => void;
  navItems?: NavCategory[];
}

const Sidebar = ({
  activePanel,
  onPanelChange,
  navItems = [],
}: SidebarProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser({
          username: parsed.username || "Collaborator",
          email: parsed.email || "collaborator@example.com",
          user_type: parsed.user_type || "collaborator",
          avatar: parsed.avatar,
        });
      }
    } catch (error) {
      console.error("Failed to load user profile", error);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/sign-in");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="hidden w-72 border-r border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-900/40 backdrop-blur-sm lg:flex lg:flex-col fixed left-0 top-0 h-screen overflow-y-auto">
      <div className="flex flex-col h-full p-4">
        {/* Header */}
        <div className="mb-6 px-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-lg shadow-blue-500/20">
              <img
                src="/maubin_navigation.png"
                alt="Logo"
                className="h-10 w-10 rounded-full border-2 border-blue-500/30 object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Maubin Navigation
              </p>
              <h2 className="text-lg font-bold text-white">
                Collaborator Panel
              </h2>
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Items */}
        {navItems && navItems.length > 0 && (
          <nav className="flex-1 space-y-4 px-2 overflow-y-auto">
            {navItems.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-1">
                {/* Category Header */}
                <div className="px-2 py-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {category.category}
                  </p>
                </div>

                {/* Category Items */}
                {category.items.map((item) => {
                  const isActive = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onPanelChange?.(item.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-white shadow-lg shadow-blue-500/10"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.count > 0 && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isActive
                              ? "bg-blue-400 text-slate-950"
                              : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        )}

        {/* Profile Section */}
        <div className="mt-auto border-t border-slate-800 pt-4 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="group flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left transition-all hover:border-blue-500/30 hover:bg-slate-800/60"
            >
              {/* Avatar */}
              <div className="relative">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="h-10 w-10 rounded-full border-2 border-blue-500/30 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-sm font-bold text-blue-400">
                    {user ? getInitials(user.username) : "CO"}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 bg-blue-500"></div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.username || "Collaborator"}
                </p>
                <p className="truncate text-xs text-slate-400 capitalize">
                  {user?.user_type || "collaborator"}
                </p>
              </div>

              {/* Chevron Icon */}
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  showProfileMenu ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
                <div className="p-3 border-b border-slate-800">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="mt-1 truncate text-sm font-medium text-white">
                    {user?.email || "collaborator@example.com"}
                  </p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => navigate("/profile")}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    View Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
