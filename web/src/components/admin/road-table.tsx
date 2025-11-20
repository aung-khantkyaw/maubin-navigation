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

export type AdminRoadRow = {
  id: string;
  city_id: string | null;
  user_id: string | null;
  name_mm: string | null;
  name_en: string | null;
  road_type: string | null;
  is_oneway: boolean | null;
  length_m: number[] | null;
  geometry: string | null;
};

type RoadTableProps = {
  roads: AdminRoadRow[];
  cityLookup: Record<string, string>;
  roadTypeOptions: string[];
  onEdit: (road: AdminRoadRow) => void;
  onDelete: (roadId: string) => void;
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
  "relative cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700 transition data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-800 data-[disabled]:opacity-50";
const ROWS_PER_PAGE_LABEL_CLASS =
  "text-[11px] uppercase tracking-[0.25em] text-emerald-700";
const TABLE_CONTAINER_CLASS =
  "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-50px_rgba(15,118,110,0.35)]";
const TABLE_HEADER_CLASS =
  "bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700";
const TABLE_CELL_TEXT_CLASS = "text-sm text-slate-700";
const TABLE_MUTED_TEXT_CLASS = "text-sm text-slate-500";
const BADGE_CLASS =
  "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_10px_25px_-20px_rgba(16,185,129,0.8)]";
const ACTION_BUTTON_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-emerald-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800";
const DANGER_BUTTON_CLASS =
  "h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700";
const PAGINATION_BUTTON_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40";

function resolveRoadName(road: AdminRoadRow) {
  return road.name_en || road.name_mm || road.id;
}

function formatRoadType(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.replace(/[_-]+/g, " ");
}

function RoadActionsCell({
  road,
  onEdit,
  onDelete,
}: {
  road: AdminRoadRow;
  onEdit: RoadTableProps["onEdit"];
  onDelete: RoadTableProps["onDelete"];
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className={ACTION_BUTTON_CLASS}
        onClick={() => onEdit(road)}
      >
        Edit
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className={DANGER_BUTTON_CLASS}
        onClick={() => onDelete(road.id)}
      >
        Delete
      </Button>
    </div>
  );
}

export default function RoadTable({
  roads,
  cityLookup,
  roadTypeOptions,
  onEdit,
  onDelete,
  pageSizeOptions = [5, 10, 20, 50],
}: RoadTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [roadTypeFilter, setRoadTypeFilter] = useState("all");
  const [oneWayFilter, setOneWayFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const uniqueCities = useMemo(() => {
    const cityIds = new Set<string>();
    roads.forEach((road) => {
      if (road.city_id) {
        cityIds.add(road.city_id);
      }
    });
    return Array.from(cityIds)
      .sort((a, b) => cityLookup[a]?.localeCompare(cityLookup[b] ?? "") ?? 0)
      .map((cityId) => ({ id: cityId, label: cityLookup[cityId] ?? cityId }));
  }, [cityLookup, roads]);

  const availableRoadTypes = useMemo(() => {
    const values = new Set<string>();
    roadTypeOptions.forEach((type) => values.add(type));
    roads.forEach((road) => {
      if (road.road_type) {
        values.add(road.road_type);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [roadTypeOptions, roads]);

  const filteredRoads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return roads.filter((road) => {
      if (cityFilter !== "all" && (road.city_id ?? "") !== cityFilter) {
        return false;
      }

      if (roadTypeFilter !== "all") {
        if ((road.road_type ?? "").toLowerCase() !== roadTypeFilter) {
          return false;
        }
      }

      if (oneWayFilter !== "all") {
        const isOneWay = Boolean(road.is_oneway);
        if (oneWayFilter === "yes" && !isOneWay) {
          return false;
        }
        if (oneWayFilter === "no" && isOneWay) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [resolveRoadName(road), road.road_type ?? ""]
        .map((value) => value?.toLowerCase?.() ?? "")
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [cityFilter, oneWayFilter, roadTypeFilter, roads, searchTerm]);

  const columns = useMemo<ColumnDef<AdminRoadRow>[]>(
    () => [
      {
        id: "name",
        header: () => "Road",
        accessorFn: (row) => resolveRoadName(row),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {resolveRoadName(row.original)}
            </p>
            {row.original.road_type ? (
              <p className="text-xs text-slate-500">
                {formatRoadType(row.original.road_type)}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "city",
        header: () => "City",
        accessorFn: (row) => row.city_id ?? "",
        cell: ({ row }) => {
          const cityId = row.original.city_id;
          if (!cityId) {
            return <span className={TABLE_MUTED_TEXT_CLASS}>—</span>;
          }
          return cityLookup[cityId] ?? cityId;
        },
      },
      {
        id: "type",
        header: () => "Type",
        accessorFn: (row) => row.road_type ?? "",
        cell: ({ getValue }) => {
          const value = getValue<string>();
          if (!value) {
            return <span className={TABLE_MUTED_TEXT_CLASS}>—</span>;
          }
          return (
            <Badge variant="outline" className={BADGE_CLASS}>
              {formatRoadType(value)}
            </Badge>
          );
        },
      },
      {
        id: "oneway",
        header: () => "One way",
        accessorFn: (row) => Boolean(row.is_oneway),
        cell: ({ getValue }) => (
          <span
            className={
              getValue<boolean>()
                ? "text-sm font-medium text-emerald-600"
                : TABLE_MUTED_TEXT_CLASS
            }
          >
            {getValue<boolean>() ? "Yes" : "No"}
          </span>
        ),
      },
      {
        id: "segments",
        header: () => "Segments",
        accessorFn: (row) => row.length_m?.length ?? 0,
        cell: ({ getValue }) => getValue<number>() ?? 0,
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <RoadActionsCell
            road={row.original}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
        enableSorting: false,
      },
    ],
    [cityLookup, onDelete, onEdit]
  );

  const table = useReactTable({
    data: filteredRoads,
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            placeholder="Search by road name or type"
            className={FILTER_INPUT_CLASS}
          />
          <Select
            value={cityFilter}
            onValueChange={(value) => {
              setCityFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT_CLASS}>
              <SelectItem className={SELECT_ITEM_CLASS} value="all">
                All cities
              </SelectItem>
              {uniqueCities.map((city) => (
                <SelectItem
                  key={city.id}
                  value={city.id}
                  className={SELECT_ITEM_CLASS}
                >
                  {city.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={roadTypeFilter}
            onValueChange={(value) => {
              setRoadTypeFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Filter by road type" />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT_CLASS}>
              <SelectItem className={SELECT_ITEM_CLASS} value="all">
                All types
              </SelectItem>
              {availableRoadTypes.map((type) => (
                <SelectItem
                  key={type}
                  value={type.toLowerCase()}
                  className={SELECT_ITEM_CLASS}
                >
                  {formatRoadType(type) ?? type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={oneWayFilter}
            onValueChange={(value) => {
              setOneWayFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className={`${SELECT_TRIGGER_CLASS} sm:w-40`}>
              <SelectValue placeholder="One way" />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT_CLASS}>
              <SelectItem className={SELECT_ITEM_CLASS} value="all">
                All
              </SelectItem>
              <SelectItem className={SELECT_ITEM_CLASS} value="yes">
                One way
              </SelectItem>
              <SelectItem className={SELECT_ITEM_CLASS} value="no">
                Two way
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 self-start">
          <span className={ROWS_PER_PAGE_LABEL_CLASS}>Rows per page</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) =>
              setPagination({ pageIndex: 0, pageSize: Number(value) })
            }
          >
            <SelectTrigger className={`${SELECT_TRIGGER_CLASS} w-32`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT_CLASS}>
              {pageSizeOptions.map((size) => (
                <SelectItem
                  key={size}
                  value={String(size)}
                  className={SELECT_ITEM_CLASS}
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  No roads found.
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
