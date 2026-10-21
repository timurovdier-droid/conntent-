"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { api } from "@/lib/client/api";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "register" ? "register" : "login";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "register") {
        await api("/api/auth/register", {
          method: "POST",
          json: {
            email: form.get("email"),
            password: form.get("password"),
            consent: form.get("consent") === "on",
          },
        });
      } else {
        await api("/api/auth/login", {
          method: "POST",
          json: { email: form.get("email"), password: form.get("password") },
        });
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось войти.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-screen">
      <section className="auth-story">
        <Link href="/" className="wordmark">
          Content<span>Pilot</span>
        </Link>
        <h1>{mode === "register" ? "Соберём первый черновик сегодня" : "С возвращением к черновикам"}</h1>
        <p>Профиль бренда и проекты остаются в вашем пространстве. Публикация наружу не запускается сама.</p>
      </section>
      <section className="auth-panel">
        <form className="auth-card stack" onSubmit={onSubmit}>
          <h2 style={{ margin: 0 }}>{mode === "register" ? "Регистрация" : "Вход"}</h2>
          {error ? <div className="alert">{error}</div> : null}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Пароль
            <input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} required />
          </label>
          {mode === "register" ? (
            <label className="check">
              <input name="consent" type="checkbox" required />
              <span>
                Соглашаюсь с <Link href="/legal/terms">условиями</Link> и <Link href="/legal/privacy">политикой конфиденциальности</Link>.
              </span>
            </label>
          ) : (
            <Link href="/forgot">Не помню пароль</Link>
          )}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Секунду…" : mode === "register" ? "Создать аккаунт" : "Войти"}
          </button>
          <p className="quiet" style={{ margin: 0 }}>
            {mode === "register" ? <Link href="/login">Уже есть аккаунт</Link> : <Link href="/register">Создать аккаунт</Link>}
          </p>
        </form>
      </section>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
