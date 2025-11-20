const LoadingSpinner = ({ label = "Loading" }: { label?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
      <span className="text-sm font-medium">{label}…</span>
    </div>
  );
};

export default LoadingSpinner;
