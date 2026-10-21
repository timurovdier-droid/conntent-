"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client/api";

type Overview = {
  users: { id: string; email: string; status: string; isAdmin: boolean; createdAt: string; successCount: number }[];
  failures: { operation: string; modelId: string; errorCode: string | null; requestId: string; createdAt: string }[];
  usage: { operation: string; status: string; count: number }[];
  limits: { textDaily: number; imageDaily: number; uploadDaily: number; embedDaily: number; ratePerMinute: number };
  aiConfigured: boolean;
  models: { text: string; image: string; embedding: string };
};

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api<Overview>("/api/admin"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Нет доступа.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveLimits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/admin", {
      method: "PATCH",
      json: {
        textDaily: Number(form.get("textDaily")),
        imageDaily: Number(form.get("imageDaily")),
        uploadDaily: Number(form.get("uploadDaily")),
        embedDaily: Number(form.get("embedDaily")),
        ratePerMinute: Number(form.get("ratePerMinute")),
      },
    });
    await load();
  }

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <p>Открываем сводку…</p>;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Сводка</h1>
          <p className="quiet">Модель {data.aiConfigured ? "доступна по ключу" : "без ключа"}. Тексты не показываются.</p>
        </div>
      </div>
      <p className="quiet">
        {data.models.text} · {data.models.image} · {data.models.embedding}
      </p>
      <form className="panel stack" style={{ width: "min(100%, 720px)", marginBottom: "1rem" }} onSubmit={saveLimits}>
        <div className="form-row" style={{ flexWrap: "wrap" }}>
          {([
            ["textDaily", "Тексты в день", data.limits.textDaily],
            ["imageDaily", "Изображения", data.limits.imageDaily],
            ["uploadDaily", "Загрузки", data.limits.uploadDaily],
            ["embedDaily", "Индексации", data.limits.embedDaily],
            ["ratePerMinute", "Запросов в минуту", data.limits.ratePerMinute],
          ] as const).map(([name, label, value]) => (
            <label key={name}>
              {label}
              <input name={name} type="number" defaultValue={value} />
            </label>
          ))}
        </div>
        <button className="btn" type="submit">
          Обновить квоты
        </button>
      </form>
      <div className="list">
        {data.users.map((user) => (
          <article className="version" key={user.id}>
            <strong>{user.email}</strong>
            <div className="quiet nums">
              {user.status} · успешных вызовов {user.successCount}
            </div>
            <button
              className="btn-ghost"
              type="button"
              onClick={() =>
                api("/api/admin", {
                  method: "PATCH",
                  json: { userId: user.id, status: user.status === "active" ? "disabled" : "active" },
                }).then(load)
              }
            >
              {user.status === "active" ? "Отключить" : "Включить"}
            </button>
          </article>
        ))}
      </div>
      <h2>Сбои генерации</h2>
      <div className="list">
        {data.failures.length === 0 ? <p className="quiet">Сбоев пока нет.</p> : null}
        {data.failures.map((failure) => (
          <article className="version" key={failure.requestId}>
            <strong>{failure.operation}</strong>
            <div className="quiet">
              {failure.errorCode || failure.modelId} · {new Date(failure.createdAt).toLocaleString("ru-RU")}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
