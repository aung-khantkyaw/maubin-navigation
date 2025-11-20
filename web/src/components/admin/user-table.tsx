import { useMemo, useState } from "react";
import type {
  ColumnDef,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type AdminUserRow = {
  id: string;
  username: string | null;
  email: string | null;
  user_type: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  last_login: string | null;
};

type UserTableProps = {
  users: AdminUserRow[];
  pageSizeOptions?: number[];
};

const DEFAULT_PAGE_SIZE = 10;

const FILTER_INPUT_CLASS =
  "h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200";
const SELECT_TRIGGER_CLASS =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:w-48";
const SELECT_CONTENT_CLASS =
  "border border-slate-200 bg-white text-slate-900 backdrop-blur-xl shadow-[0_20px_60px_-30px_rgba(16,185,129,0.45)]";
const SELECT_ITEM_CLASS =
  "relative cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 transition data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-800";
const ROWS_PER_PAGE_LABEL_CLASS =
  "text-[11px] uppercase tracking-[0.25em] text-emerald-700";
const ROWS_PER_PAGE_SELECT_CLASS =
  "h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200";
const TABLE_CONTAINER_CLASS =
  "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,118,110,0.35)]";
const TABLE_HEADER_CLASS =
  "bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700";
const TABLE_CELL_TEXT_CLASS = "text-sm text-slate-700";
const TABLE_MUTED_TEXT_CLASS = "text-sm text-slate-500";
const ROLE_BADGE_CLASS =
  "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_10px_25px_-20px_rgba(16,185,129,0.8)]";
const PAGINATION_BUTTON_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40";

function resolveRole(user: AdminUserRow) {
  if (user.user_type && user.user_type.trim().length) {
    return user.user_type.trim().toLowerCase();
  }
  if (user.is_admin) {
    return "admin";
  }
  return "member";
}

function formatRoleLabel(role: string) {
  return role
    .split(/[\s_-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  } catch {
    return value ?? "—";
  }
}

export default function UserTable({
  users,
  pageSizeOptions = [5, 10, 20, 50],
}: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    users.forEach((user) => {
      roles.add(resolveRole(user));
    });
    return Array.from(roles).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "all") {
        if (resolveRole(user) !== roleFilter) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        user.username ?? "",
        user.email ?? "",
        resolveRole(user),
      ]
        .map((value) => value?.toLowerCase?.() ?? "")
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [roleFilter, searchTerm, users]);

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        id: "name",
        header: () => "Name",
        accessorFn: (row) => row.username ?? "—",
        cell: ({ getValue }) => (
          <span className={TABLE_CELL_TEXT_CLASS}>
            {getValue<string>() ?? "—"}
          </span>
        ),
      },
      {
        id: "email",
        header: () => "Email",
        accessorFn: (row) => row.email ?? "—",
        cell: ({ getValue }) => (
          <span className={TABLE_CELL_TEXT_CLASS}>
            {getValue<string>() ?? "—"}
          </span>
        ),
      },
      {
        id: "role",
        header: () => "Role",
        accessorFn: (row) => resolveRole(row),
        cell: ({ getValue }) => (
          <Badge variant="outline" className={ROLE_BADGE_CLASS}>
            {formatRoleLabel(getValue<string>() ?? "member")}
          </Badge>
        ),
      },
      {
        id: "created",
        header: () => "Created",
        accessorFn: (row) => row.created_at ?? "",
        cell: ({ getValue }) => (
          <span className={TABLE_MUTED_TEXT_CLASS}>
            {formatDateTime(getValue<string>())}
          </span>
        ),
      },
      {
        id: "last_login",
        header: () => "Last login",
        accessorFn: (row) => row.last_login ?? "",
        cell: ({ getValue }) => (
          <span className={TABLE_MUTED_TEXT_CLASS}>
            {formatDateTime(getValue<string>())}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Input
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          placeholder="Search by name, email, or role"
          className={`${FILTER_INPUT_CLASS} md:w-96`}
        />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT_CLASS}>
              <SelectItem className={SELECT_ITEM_CLASS} value="all">
                All roles
              </SelectItem>
              {availableRoles.map((role) => (
                <SelectItem
                  key={role}
                  value={role}
                  className={SELECT_ITEM_CLASS}
                >
                  {formatRoleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 self-start">
            <span className={ROWS_PER_PAGE_LABEL_CLASS}>Rows per page</span>
            <select
              value={String(pagination.pageSize)}
              onChange={(event) =>
                setPagination({
                  pageIndex: 0,
                  pageSize: Number(event.target.value),
                })
              }
              className={`${ROWS_PER_PAGE_SELECT_CLASS} w-28 bg-white`}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={TABLE_CONTAINER_CLASS}>
        <Table>
          <TableHeader className={TABLE_HEADER_CLASS}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sortStatus = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className="px-4 py-3 cursor-pointer select-none text-xs font-medium text-emerald-800"
                      onClick={
                        isSortable
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {isSortable ? (
                        <span className="ml-2 text-[10px] text-emerald-600/80">
                          {sortStatus === "asc"
                            ? "▲"
                            : sortStatus === "desc"
                            ? "▼"
                            : ""}
                        </span>
                      ) : null}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-emerald-50/70">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`px-4 py-3 ${TABLE_CELL_TEXT_CLASS}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-500 sm:flex-row">
        <span>
          Page {currentPage} of {pageCount || 1}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={PAGINATION_BUTTON_CLASS}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={PAGINATION_BUTTON_CLASS}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
