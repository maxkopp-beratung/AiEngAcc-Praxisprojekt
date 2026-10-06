// Frame for the auth pages: no header, one centered card (docs/app-shell.md).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 md:px-6">
      <div className="w-full max-w-[400px]">{children}</div>
    </main>
  );
}
