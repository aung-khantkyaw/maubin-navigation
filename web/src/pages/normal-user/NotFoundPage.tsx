import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MYANMAR_CENTER: LatLngExpression = [21.9162, 95.956];

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-slate-50 to-emerald-50 px-6 py-16 text-slate-900">
      <Card className="w-full max-w-5xl border border-slate-200 bg-white/90 backdrop-blur-xl shadow-[0_30px_110px_-45px_rgba(16,185,129,0.35)]">
        <CardHeader className="flex flex-col gap-4 pb-2">
          <Badge className="w-fit border border-emerald-200 bg-emerald-50 px-3 py-1 text-[0.65rem] uppercase tracking-[0.45em] text-emerald-600">
            404
          </Badge>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-semibold leading-snug text-slate-900">
              We can’t find that route. Try searching for a new destination.
            </CardTitle>
            <p className="text-sm text-slate-500">
              အဲ့ဒီလမ်းမရှိပါ။ နောက်တစ်ခုရွေးပြီး ခရီးထွက်ကြပါစို့။
            </p>
          </div>
          <div className="relative mt-5 w-full text-slate-900 md:max-w-lg">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search city or destination…"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-200"
            />
          </div>
        </CardHeader>

        <CardContent className="grid gap-8 md:grid-cols-[1.25fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_30px_85px_-50px_rgba(16,185,129,0.35)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
                You are lost!
              </div>
              <p className="mt-3 text-base text-slate-600">
                Pick a place on the map or jump to one of our favourite trips to
                continue exploring Myanmar.
              </p>

              <dl className="mt-6 space-y-3 text-sm text-slate-500">
                <div className="flex items-center gap-3">
                  <dt className="w-32 font-medium text-slate-700">
                    Suggested cities
                  </dt>
                  <dd className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700"
                    >
                      Yangon
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700"
                    >
                      Mandalay
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700"
                    >
                      Bagan
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center gap-3">
                  <dt className="w-32 font-medium text-slate-700">
                    Helpful tips
                  </dt>
                  <dd className="text-slate-600">
                    Search for major cities or UNESCO sites to begin routing.
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  className="shadow-[0_22px_45px_-30px_rgba(16,185,129,0.45)]"
                  onClick={() => navigate("/")}
                >
                  Go Home
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => navigate("/landmark-map")}
                >
                  View Popular Destinations
                </Button>
              </div>
            </div>
          </div>

          <div className="relative h-[18rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_25px_80px_-45px_rgba(16,185,129,0.35)]">
            <MapContainer
              center={MYANMAR_CENTER}
              zoom={6}
              style={{ height: "100%", width: "100%" }}
              className="leaflet-container"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={MYANMAR_CENTER}>
                <Popup className="!rounded-xl !border !border-slate-200 !bg-white !text-slate-900 shadow-xl">
                  <p className="text-sm font-semibold">You are lost!</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tap a new spot to plot a route.
                  </p>
                </Popup>
              </Marker>
            </MapContainer>
            <div className="pointer-events-none absolute inset-x-6 bottom-6 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-xs text-slate-600 shadow-[0_12px_45px_-25px_rgba(16,185,129,0.45)]">
              <p className="font-medium text-slate-900">Tip</p>
              <p className="text-slate-600">
                Drag the map to explore popular regions or drop a marker on a
                new destination.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
