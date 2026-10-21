"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { LANGUAGES } from "@/lib/constants";
import type { Me } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Me>("/api/me").then(setMe);
  }, []);

  async function saveLocale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const locale = String(new FormData(event.currentTarget).get("locale"));
    try {
      await api("/api/account", { method: "PATCH", json: { locale } });
      setMessage("Язык интерфейсных подсказок сохранён. Язык каждого текста задаётся при создании.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не сохранилось.");
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    if (!confirm("Удалить аккаунт, проекты, файлы и базу знаний?")) return;
    try {
      await api("/api/account", { method: "DELETE", json: { password } });
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Удаление не выполнено.");
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Настройки</h1>
          <p className="quiet">{me?.user.email}</p>
        </div>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="alert ok">{message}</div> : null}
      <div className="stack" style={{ maxWidth: 640 }}>
        <form key={me?.user.locale || "locale"} className="panel stack" style={{ width: "auto" }} onSubmit={saveLocale}>
          <label>
            Предпочтительный язык
            <select name="locale" defaultValue={me?.user.locale || "ru"}>
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            Сохранить
          </button>
        </form>
        <section className="panel" style={{ width: "auto" }}>
          <h2>Данные</h2>
          <p className="quiet">
            Удаление проекта убирает версии и файлы сразу. Удаление аккаунта стирает пространство, базу знаний и историю использования в базе приложения. Резервные копии хостинга, если они включены, живут по правилам площадки.
          </p>
        </section>
        <form className="panel stack" style={{ width: "auto" }} onSubmit={remove}>
          <h2 style={{ margin: 0 }}>Удалить аккаунт</h2>
          <label>
            Текущий пароль
            <input name="password" type="password" required />
          </label>
          <button className="btn-danger" type="submit">
            Удалить аккаунт и данные
          </button>
        </form>
      </div>
    </>
  );
}
