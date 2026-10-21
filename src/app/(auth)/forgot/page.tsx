"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client/api";

export default function ForgotPage() {
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const email = String(new FormData(event.currentTarget).get("email") || "");
    try {
      const result = await api<{ message: string; devResetUrl: string | null }>("/api/auth/forgot", {
        method: "POST",
        json: { email },
      });
      setMessage(result.message);
      setLink(result.devResetUrl || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось отправить запрос.");
    }
  }

  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <form className="auth-card stack" onSubmit={onSubmit}>
        <Link href="/login">Назад ко входу</Link>
        <h1 style={{ margin: 0, fontSize: "2.4rem" }}>Восстановление доступа</h1>
        <p className="quiet">Укажите email. Если аккаунт есть, подготовим ссылку для нового пароля.</p>
        {error ? <div className="alert">{error}</div> : null}
        {message ? <div className="alert ok">{message}</div> : null}
        {link ? (
          <p>
            Локальная ссылка: <Link href={link.replace(/^https?:\/\/[^/]+/, "")}>{link}</Link>
          </p>
        ) : null}
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <button className="btn" type="submit">
          Подготовить ссылку
        </button>
      </form>
    </main>
  );
}
