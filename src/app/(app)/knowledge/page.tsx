"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client/api";

type DocumentItem = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  errorMessage: string;
  indexNote: string;
  chunkCount: number;
  sizeBytes: number;
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const data = await api<{ documents: DocumentItem[] }>("/api/knowledge/documents");
    setDocuments(data.documents);
  }

  useEffect(() => {
    load().catch((caught) => setError(caught.message));
  }, []);

  async function onFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/api/knowledge/documents", { method: "POST", body: data });
      form.reset();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Файл не обработан.");
    } finally {
      setPending(false);
    }
  }

  async function onNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/api/knowledge/documents", {
        method: "POST",
        json: { title: form.get("title"), text: form.get("text") },
      });
      formElement.reset();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Заметка не сохранена.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>База знаний</h1>
          <p className="quiet">PDF, DOCX, TXT, Markdown или заметка. Файлы до 10 МБ. Агент видит только это пространство.</p>
        </div>
      </div>
      {error ? <div className="alert" style={{ marginBottom: "1rem" }}>{error}</div> : null}
      <div className="editor">
        <form className="panel stack" style={{ width: "auto" }} onSubmit={onFile}>
          <h2 style={{ margin: 0 }}>Файл</h2>
          <input name="file" type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" required />
          <button className="btn" disabled={pending} type="submit">
            {pending ? "Обрабатываем…" : "Загрузить"}
          </button>
        </form>
        <form className="panel stack" style={{ width: "auto" }} onSubmit={onNote}>
          <h2 style={{ margin: 0 }}>Заметка</h2>
          <label>
            Название
            <input name="title" required />
          </label>
          <label>
            Текст
            <textarea name="text" required />
          </label>
          <button className="btn" disabled={pending} type="submit">
            Сохранить заметку
          </button>
        </form>
      </div>
      <div className="list" style={{ marginTop: "1rem" }}>
        {documents.length === 0 ? <p className="quiet">Источников пока нет. После статуса «готово» они участвуют в новых черновиках.</p> : null}
        {documents.map((document) => (
          <article className="version" key={document.id}>
            <strong>{document.title}</strong>
            <div className="quiet">
              {document.status === "ready" ? "Готово" : document.status === "failed" ? "Ошибка" : "Обработка"} · фрагментов {document.chunkCount}
            </div>
            {document.errorMessage ? <p>{document.errorMessage}</p> : null}
            {document.indexNote ? <p className="quiet">{document.indexNote}</p> : null}
            <div className="actions">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => api(`/api/knowledge/documents/${document.id}/reindex`, { method: "POST" }).then(load).catch((caught) => setError(caught.message))}
              >
                Повторить обработку
              </button>
              <button
                className="btn-danger"
                type="button"
                onClick={() => {
                  if (!confirm("Удалить источник, фрагменты и файл?")) return;
                  api(`/api/knowledge/documents/${document.id}`, { method: "DELETE" }).then(load);
                }}
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
