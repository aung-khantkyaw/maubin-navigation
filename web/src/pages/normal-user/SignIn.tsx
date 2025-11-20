import { LoginForm } from "@/components/login-form";

import { MapContainer, TileLayer } from "react-leaflet";
import type { LatLngTuple } from "leaflet";

export default function LoginPage() {
  const mapCenter: LatLngTuple = [19.7468086, 96.0675273];
  return (
    <div className="grid min-h-svh bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 text-slate-900 lg:grid-cols-2">
      <div className="flex flex-col gap-6 bg-white/95 p-6 shadow-2xl md:p-12">
        <div className="flex justify-center gap-2 md:justify-start">
          <div className="flex size-20 items-center justify-center rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 shadow-lg">
            <img src="/maubin_navigation.png" alt="Logo" className="size-16" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white/95 p-10 text-slate-900 shadow-2xl backdrop-blur">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-gradient-to-bl from-emerald-200/70 via-teal-100/70 to-slate-100 lg:block">
        <MapContainer
          center={mapCenter}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </MapContainer>
      </div>
    </div>
  );
}
