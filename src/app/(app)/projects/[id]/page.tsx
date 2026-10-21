"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, idempotencyHeaders } from "@/lib/client/api";
import { contentToMarkdown, contentToPlain } from "@/lib/content/format";
import { CONTENT_TYPES, PLATFORMS, labelOf } from "@/lib/constants";
import type { ContentResult, SourceRef, TaskInput } from "@/lib/types";

type Version = {
  id: string;
  promptSummary: string;
  content: ContentResult;
  sources: SourceRef[];
  status: string;
  createdAt: string;
};

type Asset = {
  id: string;
  status: string;
  errorMessage: string;
  downloadUrl: string | null;
  createdAt: string;
};

type Payload = {
  project: {
    id: string;
    title: string;
    contentType: string;
    platform: string;
    task: TaskInput;
  };
  versions: Version[];
  assets: Asset[];
};

const commands = [
  ["Короче", "Сократи текст примерно вдвое. Сохрани факты, запреты и смысл."],
  ["Подробнее", "Расширь текст, не добавляя новых фактов."],
  ["Сильнее начало", "Сделай более сильный первый абзац. Остальное по смыслу сохрани."],
  ["Без эмодзи", "Убери эмодзи и не добавляй новые."],
  ["Другой призыв", "Замени призыв к действию на более конкретный, без новых обещаний."],
  ["На узбекский", "Переведи весь результат на узбекский язык. Факты и запреты сохрани."],
  ["На русский", "Переведи весь результат на русский язык. Факты и запреты сохрани."],
];

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<ContentResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const [instruction, setInstruction] = useState("");
  const [imageNote, setImageNote] = useState("");

  async function reload(selectLatest = true) {
    const data = await api<Payload>(`/api/projects/${params.id}`);
    setPayload(data);
    const latest = data.versions[data.versions.length - 1];
    if (selectLatest && latest) {
      setActiveId(latest.id);
      setDraft(latest.content);
    }
    return data;
  }

  useEffect(() => {
    const stored = sessionStorage.getItem("cp-notice");
    if (stored) {
      setNotice(stored);
      sessionStorage.removeItem("cp-notice");
    }
    reload().catch((caught) => setError(caught.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const active = useMemo(() => payload?.versions.find((version) => version.id === activeId), [payload, activeId]);

  function choose(version: Version) {
    setActiveId(version.id);
    setDraft(version.content);
  }

  async function run(label: string, action: () => Promise<void>) {
    setPending(label);
    setError("");
    try {
      await action();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Действие не выполнилось.");
    } finally {
      setPending("");
    }
  }

  async function edit(text: string) {
    if (!active) return;
    await run("Правим…", async () => {
      await api(`/api/projects/${params.id}/edit`, {
        method: "POST",
        headers: idempotencyHeaders(),
        json: { baseVersionId: active.id, instruction: text },
      });
    });
  }

  async function onInstruction(event: FormEvent) {
    event.preventDefault();
    if (!instruction.trim()) return;
    const text = instruction;
    setInstruction("");
    await edit(text);
  }

  async function saveManual() {
    if (!draft) return;
    await run("Сохраняем…", async () => {
      await api(`/api/projects/${params.id}/versions`, {
        method: "POST",
        json: { ...draft, baseVersionId: activeId },
      });
    });
  }

  async function retry() {
    if (!payload) return;
    await run("Собираем…", async () => {
      await api("/api/content/generate", {
        method: "POST",
        headers: idempotencyHeaders(),
        json: { ...payload.project.task, projectId: payload.project.id },
      });
    });
  }

  async function copyText() {
    if (!draft) return;
    await navigator.clipboard.writeText(contentToPlain(draft, active?.sources || []));
    await api("/api/events", { method: "POST", json: { type: "copy", projectId: params.id } });
    setNotice("Текст скопирован.");
  }

  async function rename(title: string) {
    await api(`/api/projects/${params.id}`, { method: "PATCH", json: { title } });
  }

  async function remove() {
    if (!confirm("Удалить проект и его версии?")) return;
    await api(`/api/projects/${params.id}`, { method: "DELETE" });
    router.push("/projects");
  }

  if (!payload) {
    return error ? <div className="alert">{error}</div> : <p>Открываем проект…</p>;
  }

  if (!draft || payload.versions.length === 0) {
    return (
      <div className="panel stack" style={{ width: "auto" }}>
        <h1>{payload.project.title}</h1>
        {notice ? <div className="alert">{notice}</div> : null}
        {error ? <div className="alert">{error}</div> : null}
        <p>Черновик ещё не готов. Можно повторить генерацию с теми же параметрами.</p>
        <button className="btn" type="button" onClick={retry} disabled={Boolean(pending)}>
          {pending || "Повторить"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-title">
        <div>
          <input
            aria-label="Название проекта"
            defaultValue={payload.project.title}
            onBlur={(event) => rename(event.target.value).catch((caught) => setError(caught.message))}
            style={{ fontFamily: "var(--font-display)", fontSize: "2rem", border: 0, background: "transparent", padding: 0 }}
          />
          <p className="quiet">
            {labelOf(CONTENT_TYPES, payload.project.contentType)} · {labelOf(PLATFORMS, payload.project.platform)}
          </p>
        </div>
        <button className="btn-danger" type="button" onClick={remove}>
          Удалить
        </button>
      </div>
      {notice ? <div className="alert" style={{ marginBottom: "0.8rem" }}>{notice}</div> : null}
      {error ? <div className="alert" style={{ marginBottom: "0.8rem" }}>{error}</div> : null}
      <div className="editor">
        <section className="panel stack" style={{ width: "auto" }}>
          <div className="actions" style={{ flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={copyText}>Скопировать</button>
            <button className="btn-ghost" type="button" onClick={saveManual} disabled={Boolean(pending)}>Сохранить правку</button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                download(`${payload.project.title}.md`, contentToMarkdown(draft, active?.sources || []), "text/markdown");
                api("/api/events", { method: "POST", json: { type: "export", projectId: params.id } });
              }}
            >
              Markdown
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => download(`${payload.project.title}.txt`, contentToPlain(draft, active?.sources || []), "text/plain")}
            >
              TXT
            </button>
          </div>
          <label>
            Заголовок
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            Первый абзац
            <textarea value={draft.hook} onChange={(event) => setDraft({ ...draft, hook: event.target.value })} />
          </label>
          <label>
            Текст
            <textarea style={{ minHeight: "16rem" }} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          </label>
          <label>
            Призыв
            <input value={draft.cta} onChange={(event) => setDraft({ ...draft, cta: event.target.value })} />
          </label>
          <label>
            Хештеги через пробел
            <input
              value={draft.hashtags.join(" ")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  hashtags: event.target.value.split(/\s+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean),
                })
              }
            />
          </label>
          {draft.notesToVerify.length ? (
            <div>
              <strong>Проверить перед публикацией</strong>
              <ul>
                {draft.notesToVerify.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {active?.sources.length ? (
            <div className="stack">
              <strong>Использованные источники</strong>
              {active.sources.map((source) => (
                <article className="source" key={source.chunkId}>
                  <strong>{source.title}</strong>
                  {source.page ? <span className="quiet"> · стр. {source.page}</span> : null}
                  <p className="quiet">{source.excerpt}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
        <aside className="side">
          <form className="panel stack" style={{ width: "auto" }} onSubmit={onInstruction}>
            <label>
              Что изменить
              <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Сделай короче и убери эмодзи" />
            </label>
            <button className="btn" disabled={Boolean(pending)} type="submit">
              {pending || "Применить"}
            </button>
            <div className="chips">
              {commands.map(([label, text]) => (
                <button key={label} className="btn-ghost" type="button" disabled={Boolean(pending)} onClick={() => edit(text)}>
                  {label}
                </button>
              ))}
              <button
                className="btn-ghost"
                type="button"
                disabled={Boolean(pending)}
                onClick={() =>
                  run("Варианты…", async () => {
                    await api(`/api/projects/${params.id}/variants`, {
                      method: "POST",
                      headers: idempotencyHeaders(),
                      json: { baseVersionId: activeId },
                    });
                  })
                }
              >
                3 варианта
              </button>
            </div>
          </form>
          <section className="panel stack" style={{ width: "auto" }}>
            <strong>Изображение</strong>
            <label>
              Уточнение
              <input value={imageNote} onChange={(event) => setImageNote(event.target.value)} />
            </label>
            <button
              className="btn"
              type="button"
              disabled={Boolean(pending)}
              onClick={() =>
                run("Рисуем…", async () => {
                  await api(`/api/projects/${params.id}/assets`, {
                    method: "POST",
                    headers: idempotencyHeaders(),
                    json: { versionId: activeId, note: imageNote },
                  });
                })
              }
            >
              Создать изображение
            </button>
            {payload.assets.map((asset) => (
              <div key={asset.id}>
                <span className="quiet">{asset.status === "ready" ? "Готово" : asset.status === "failed" ? asset.errorMessage : "В работе"}</span>
                {asset.downloadUrl ? (
                  <div>
                    <a href={asset.downloadUrl}>Скачать</a>
                  </div>
                ) : null}
              </div>
            ))}
          </section>
          <section className="stack">
            <strong>Версии</strong>
            {payload.versions
              .slice()
              .reverse()
              .map((version) => (
                <button key={version.id} className="version" type="button" onClick={() => choose(version)} style={{ textAlign: "left" }}>
                  <strong>{version.content.variantLabel || version.promptSummary}</strong>
                  <div className="quiet">{new Date(version.createdAt).toLocaleString("ru-RU")}</div>
                  {version.id !== payload.versions[payload.versions.length - 1]?.id ? (
                    <span
                      className="quiet"
                      onClick={(event) => {
                        event.stopPropagation();
                        run("Восстанавливаем…", async () => {
                          await api(`/api/projects/${params.id}/versions`, { method: "POST", json: { versionId: version.id } });
                        });
                      }}
                    >
                      Сделать текущей
                    </span>
                  ) : null}
                </button>
              ))}
          </section>
          <form
            className="panel stack"
            style={{ width: "auto" }}
            onSubmit={(event) => {
              event.preventDefault();
              const score = Number(new FormData(event.currentTarget).get("score"));
              api(`/api/projects/${params.id}/feedback`, { method: "POST", json: { score } }).then(() => setNotice("Спасибо, оценка сохранена."));
            }}
          >
            <label>
              Насколько черновик пригодился
              <select name="score" defaultValue="4">
                <option value="5">5 — можно почти публиковать</option>
                <option value="4">4 — полезно</option>
                <option value="3">3 — средняя основа</option>
                <option value="2">2 — много править</option>
                <option value="1">1 — не пригодился</option>
              </select>
            </label>
            <button className="btn-ghost" type="submit">
              Оценить
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
