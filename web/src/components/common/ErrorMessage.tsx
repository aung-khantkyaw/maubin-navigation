const ErrorMessage = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-600">
      <p className="font-semibold">{title}</p>
      {description ? (
        <p className="text-sm text-rose-500">{description}</p>
      ) : null}
    </div>
  );
};

export default ErrorMessage;
