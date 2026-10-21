"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBook,
  IconFolder,
  IconGear,
  IconGrid,
  IconLogout,
  IconPlus,
  IconTag,
} from "@/components/icons";
import { QuotaBar } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { Me } from "@/lib/types";

const links: { href: string; label: string; icon: typeof IconGrid }[] = [
  { href: "/dashboard", label: "Обзор", icon: IconGrid },
  { href: "/create", label: "Создать", icon: IconPlus },
  { href: "/projects", label: "Проекты", icon: IconFolder },
  { href: "/brand", label: "Бренд", icon: IconTag },
  { href: "/knowledge", label: "База знаний", icon: IconBook },
  { href: "/settings", label: "Настройки", icon: IconGear },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<Me>("/api/me")
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router, pathname]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="shell">
      <aside className={open ? "rail open" : "rail"}>
        <div className="row" style={{ justifyContent: "space-between", padding: "0 0.45rem" }}>
          <Link className="wordmark" href="/dashboard">
            Content<span>Pilot</span>
          </Link>
          <button
            className="menu-button"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Меню
          </button>
        </div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              className="nav-link"
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon />
              {label}
            </Link>
          ))}
          {me?.user.isAdmin ? (
            <Link className="nav-link" href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>
              <IconGear />
              Админ
            </Link>
          ) : null}
        </nav>
        <div className="rail-footer">
          {me ? (
            <>
              <QuotaBar label="Тексты" used={me.quota.text.used} limit={me.quota.text.limit} />
              <QuotaBar label="Изображения" used={me.quota.image.used} limit={me.quota.image.limit} />
              <button className="btn-rail" type="button" onClick={logout}>
                <IconLogout />
                Выйти
              </button>
            </>
          ) : (
            <span className="quiet" style={{ color: "var(--rail-muted)", fontSize: "0.875rem" }}>
              Загрузка…
            </span>
          )}
        </div>
      </aside>
      <div className="workspace">{me ? children : <p className="quiet">Открываем рабочее пространство…</p>}</div>
    </div>
  );
}

export function useNotice() {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem("cp-notice");
    if (stored) {
      setNotice(stored);
      sessionStorage.removeItem("cp-notice");
    }
  }, []);
  return notice;
}
