const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-white/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>
          &copy; {new Date().getFullYear()} ASEAN Digital Awards. All rights
          reserved.
        </span>
        <span>Crafted with care for digital collaboration across ASEAN.</span>
      </div>
    </footer>
  );
};

export default Footer;
