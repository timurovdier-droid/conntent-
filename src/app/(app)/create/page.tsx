"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/ui";
import { api, idempotencyHeaders } from "@/lib/client/api";
import { CONTENT_TYPES, GOALS, LANGUAGES, PLATFORMS } from "@/lib/constants";

export default function CreatePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const task = {
      contentType: String(form.get("contentType")),
      platform: String(form.get("platform")),
      goal: String(form.get("goal")),
      language: String(form.get("language")),
      topic: String(form.get("topic") || ""),
      tone: String(form.get("tone") || ""),
      audience: String(form.get("audience") || ""),
      constraints: String(form.get("constraints") || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      useKnowledgeBase: form.get("useKnowledgeBase") === "on",
    };
    try {
      const created = await api<{ id: string }>("/api/projects", { method: "POST", json: task });
      try {
        await api(`/api/content/generate`, {
          method: "POST",
          headers: idempotencyHeaders(),
          json: { ...task, projectId: created.id },
        });
      } catch (caught) {
        sessionStorage.setItem("cp-notice", caught instanceof Error ? caught.message : "Черновик не собрался.");
      }
      router.push(`/projects/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать проект.");
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Новый черновик"
        description="Достаточно темы и формата. Остальное можно раскрыть ниже."
      />
      <form className="panel stack" style={{ width: "min(100%, 760px)" }} onSubmit={onSubmit}>
        {error ? <div className="alert">{error}</div> : null}
        <label>
          Формат
          <select name="contentType" defaultValue="social_post">
            {CONTENT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            Площадка
            <select name="platform" defaultValue="instagram">
              {PLATFORMS.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Цель
            <select name="goal" defaultValue="leads">
              {GOALS.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Язык текста
            <select name="language" defaultValue="ru">
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Тема, продукт или задача
          <textarea name="topic" required placeholder="Например: запись на дегустацию кофе в субботу, без указания цены" />
        </label>
        <label className="check">
          <input name="useKnowledgeBase" type="checkbox" defaultChecked />
          <span>Опираться на базу знаний этого пространства</span>
        </label>
        <button className="btn-ghost" type="button" onClick={() => setAdvanced((value) => !value)}>
          {advanced ? "Скрыть дополнительное" : "Дополнительно"}
        </button>
        {advanced ? (
          <>
            <label>
              Тон для этой задачи
              <input name="tone" placeholder="Если пусто, возьмём тон бренда" />
            </label>
            <label>
              Аудитория для этой задачи
              <input name="audience" />
            </label>
            <label>
              Ограничения, каждое с новой строки
              <textarea name="constraints" placeholder={"не выдумывать цену\nбез эмодзи"} />
            </label>
          </>
        ) : null}
        <button className="btn" disabled={pending} type="submit">
          {pending ? "Собираем черновик…" : "Создать контент"}
        </button>
      </form>
    </>
  );
}
