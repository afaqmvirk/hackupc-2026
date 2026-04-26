import Link from "next/link";
import { cn } from "@/lib/utils";

export function SplashPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#2c17b8] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_12%,rgba(199,183,255,0.32),transparent_34%),linear-gradient(135deg,#7029ea_0%,#4d21ce_45%,#22109b_100%)]" />
      <div className="absolute inset-0 opacity-50">
        <div className="absolute left-[10%] top-[12%] h-44 w-44 bg-white/8" />
        <div className="absolute right-[13%] top-[14%] h-36 w-52 bg-white/12" />
        <div className="absolute bottom-[9%] left-[33%] h-52 w-60 bg-white/10" />
        <div className="absolute bottom-[22%] right-[18%] h-56 w-64 bg-[#171345]/20" />
        <div className="absolute left-[39%] top-[7%] h-24 w-32 bg-[#3713bd]/35" />
      </div>

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <PurplePagesMark className="scale-75" />
          <span className="text-sm font-bold leading-tight">
            Purple
            <br />
            Pages
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-semibold text-white/75 md:flex">
          <Link href="/dashboard" className="transition hover:text-white">
            Dashboard
          </Link>
          <Link href="/dashboard" className="transition hover:text-white">
            Creatives
          </Link>
          <Link href="/dashboard" className="transition hover:text-white">
            Swarm
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-white/20 bg-white/12 px-5 text-sm font-bold text-white shadow-[0_16px_44px_rgba(15,8,82,0.24)] backdrop-blur transition hover:bg-white/18"
        >
          Open App
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-92px)] max-w-5xl flex-col items-center justify-center px-5 pb-16 text-center">
        <div className="mb-8">
          <PurplePagesHeroLogo />
        </div>
        <p className="max-w-sm text-[17px] font-medium leading-7 text-white/78">
          Campaign insights.
          <br />
          Simplified.
        </p>
        <Link
          href="/dashboard"
          className="mt-10 inline-flex h-14 min-w-60 items-center justify-center gap-5 rounded-[14px] bg-white px-8 text-sm font-bold text-[#5b28c9] shadow-[0_22px_60px_rgba(12,7,70,0.34)] transition hover:-translate-y-0.5 hover:bg-[#f6f2ff]"
        >
          Get Started
          <span aria-hidden className="text-xl leading-none">
            -&gt;
          </span>
        </Link>
      </section>
    </main>
  );
}

function PurplePagesMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-flex h-9 w-7 shrink-0 items-center justify-center", className)}
      aria-hidden
    >
      <span className="absolute left-0 h-7 w-[2px] bg-white/95" />
      <span className="absolute left-[5px] h-7 w-[2px] bg-white/85" />
      <span className="absolute left-[10px] h-7 w-[2px] bg-white/75" />
      <span className="absolute left-[17px] h-7 w-[2px] bg-white/55" />
    </span>
  );
}

function PurplePagesHeroLogo() {
  return (
    <div className="relative flex h-[220px] w-[360px] max-w-[84vw] items-center justify-center">
      <div className="absolute left-6 top-12 flex h-28 w-12 items-stretch gap-2">
        <span className="w-1.5 bg-white" />
        <span className="w-1.5 bg-white" />
        <span className="w-1.5 bg-white" />
        <span className="w-1.5 bg-white" />
      </div>
      <div className="absolute left-[84px] top-8 h-36 w-52 border-[6px] border-white/95 border-b-0" />
      <div className="absolute bottom-7 right-14 h-[6px] w-36 bg-white" />
      <h1 className="relative z-10 text-left text-5xl font-black leading-[0.96] tracking-[0] text-white sm:text-6xl">
        Purple
        <br />
        Pages
      </h1>
    </div>
  );
}
