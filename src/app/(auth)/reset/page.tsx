"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { api } from "@/lib/client/api";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  const token = params.get("token") || "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const password = String(new FormData(event.currentTarget).get("password") || "");
    try {
      await api("/api/auth/reset", { method: "POST", json: { token, password } });
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ссылка не сработала.");
    }
  }

  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <form className="auth-card stack" onSubmit={onSubmit}>
        <h1 style={{ margin: 0, fontSize: "2.4rem" }}>Новый пароль</h1>
        {error ? <div className="alert">{error}</div> : null}
        {!token ? <div className="alert">В ссылке нет токена. Запросите восстановление ещё раз.</div> : null}
        <label>
          Новый пароль
          <input name="password" type="password" minLength={8} required />
        </label>
        <button className="btn" type="submit" disabled={!token}>
          Сохранить пароль
        </button>
        <Link href="/forgot">Запросить новую ссылку</Link>
      </form>
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
