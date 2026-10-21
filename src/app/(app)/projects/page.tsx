"use client";

import Link from "next/link";
import { PageHeader, PrimaryLink } from "@/components/ui";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { CONTENT_TYPES, labelOf } from "@/lib/constants";

type Project = { id: string; title: string; contentType: string; platform: string; updatedAt: string };

export default function ProjectsPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState("");

  async function load(nextQuery = query) {
    try {
      const data = await api<{ items: Project[] }>(`/api/projects?query=${encodeURIComponent(nextQuery)}`);
      setItems(data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось открыть проекты.");
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    load(query);
  }

  return (
    <>
      <PageHeader title="Проекты" action={<PrimaryLink href="/create">Создать контент</PrimaryLink>} />
      <form className="row" onSubmit={onSubmit} style={{ marginBottom: "1rem" }}>
        <label style={{ flex: 1 }}>
          Поиск по названию
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button className="btn-ghost" type="submit">
          Найти
        </button>
      </form>
      {error ? <div className="alert">{error}</div> : null}
      <div className="list">
        {items.length === 0 ? <p className="quiet">Ничего не нашлось. Создайте новый черновик или измените запрос.</p> : null}
        {items.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <strong>{project.title}</strong>
            <div className="quiet">
              {labelOf(CONTENT_TYPES, project.contentType)} · {new Date(project.updatedAt).toLocaleString("ru-RU")}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
