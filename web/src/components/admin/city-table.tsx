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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AdminCityRow = {
  id: string;
  user_id: string | null;
  name_mm: string | null;
  name_en: string | null;
  address_mm: string | null;
  address_en: string | null;
  description_mm: string | null;
  description_en: string | null;
  image_urls: string[] | string | null;
  geometry: string | null;
  is_active?: boolean;
};

type CityTableProps = {
  cities: AdminCityRow[];
  onEdit: (city: AdminCityRow) => void;
  onDelete: (cityId: string) => void;
  pageSizeOptions?: number[];
};

const DEFAULT_PAGE_SIZE = 10;

const FILTER_INPUT_CLASS =
  "h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200";
const ROWS_PER_PAGE_LABEL_CLASS =
  "text-[11px] uppercase tracking-[0.25em] text-emerald-700";
const TABLE_CONTAINER_CLASS =
  "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,118,110,0.35)]";
const SELECT_BASE_CLASS =
  "h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200";
const ACTION_BUTTON_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-emerald-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800";
const DANGER_BUTTON_CLASS =
  "h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700";
const TABLE_HEADER_CLASS =
  "bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700";
const TABLE_CELL_TEXT_CLASS = "text-sm text-slate-700";
const TABLE_MUTED_TEXT_CLASS = "text-sm text-slate-500";
const PAGINATION_BUTTON_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40";

function resolveCityName(city: AdminCityRow) {
  return city.name_en || city.name_mm || city.id;
}

function resolveCityAddress(city: AdminCityRow) {
  return city.address_en || city.address_mm || "";
}

function resolveCityDescription(city: AdminCityRow) {
  return city.description_en || city.description_mm || "";
}

function getImageCount(imageValue: AdminCityRow["image_urls"]) {
  if (!imageValue) {
    return 0;
  }
  if (Array.isArray(imageValue)) {
    return imageValue.length;
  }
  try {
    const parsed = JSON.parse(imageValue);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch {
    const segments = imageValue.split(",").map((value) => value.trim());
    return segments.filter(Boolean).length;
  }
  return 0;
}

function CityActionsCell({
  city,
  onEdit,
  onDelete,
}: {
  city: AdminCityRow;
  onEdit: CityTableProps["onEdit"];
  onDelete: CityTableProps["onDelete"];
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className={ACTION_BUTTON_CLASS}
        onClick={() => onEdit(city)}
      >
        Edit
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className={DANGER_BUTTON_CLASS}
        onClick={() => onDelete(city.id)}
      >
        Delete
      </Button>
    </div>
  );
}

export default function CityTable({
  cities,
  onEdit,
  onDelete,
  pageSizeOptions = [5, 10, 20, 50],
}: CityTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const filteredCities = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return cities;
    }
    return cities.filter((city) => {
      const haystack = [
        resolveCityName(city),
        resolveCityAddress(city),
        resolveCityDescription(city),
      ]
        .map((value) => value?.toLowerCase?.() ?? "")
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [cities, searchTerm]);

  const columns = useMemo<ColumnDef<AdminCityRow>[]>(
    () => [
      {
        id: "name",
        header: () => "City",
        accessorFn: (row) => resolveCityName(row),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {resolveCityName(row.original)}
            </p>
          </div>
        ),
      },
      {
        id: "address",
        header: () => "Address",
        accessorFn: (row) => resolveCityAddress(row),
        cell: ({ getValue }) => {
          const value = getValue<string>();
          if (!value) {
            return <span className={TABLE_MUTED_TEXT_CLASS}>—</span>;
          }
          return value;
        },
      },
      {
        id: "images",
        header: () => "Images",
        accessorFn: (row) => getImageCount(row.image_urls),
        cell: ({ getValue }) => getValue<number>() ?? 0,
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <CityActionsCell
            city={row.original}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
        enableSorting: false,
      },
    ],
    [onDelete, onEdit]
  );

  const table = useReactTable({
    data: filteredCities,
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          placeholder="Search by name, address, or description"
          className={`${FILTER_INPUT_CLASS} md:w-96`}
        />
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
            className={`${SELECT_BASE_CLASS} w-28 bg-white`}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
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
                      className={`px-4 py-3 text-xs font-medium text-emerald-800 ${
                        header.id === "actions"
                          ? "text-right"
                          : "cursor-pointer select-none"
                      }`}
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
                      className={`px-4 py-3 ${TABLE_CELL_TEXT_CLASS} ${
                        cell.column.id === "actions" ? "text-right" : ""
                      }`}
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
                  No cities found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
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
