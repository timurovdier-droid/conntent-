"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, PrimaryLink } from "@/components/ui";
import { api } from "@/lib/client/api";
import { CONTENT_TYPES, labelOf } from "@/lib/constants";
import type { Me } from "@/lib/types";

type Project = { id: string; title: string; contentType: string; updatedAt: string; status: string };

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api<Me>("/api/me").then(setMe);
    api<{ items: Project[] }>("/api/projects?limit=6").then((data) => setProjects(data.items));
  }, []);

  return (
    <>
      <PageHeader
        title={me?.brand.name ? me.brand.name : "Ваше пространство"}
        description="Сначала черновик, потом правки. Публикация остаётся за вами."
        action={<PrimaryLink href="/create">Создать контент</PrimaryLink>}
      />
      {me && !me.brand.name ? (
        <Alert tone="neutral">
          <p style={{ margin: "0 0 0.75rem" }}>Профиль бренда ещё пустой. Заполните его сейчас или вернитесь позже.</p>
          <Link className="btn-ghost" href="/brand">
            Заполнить бренд
          </Link>
        </Alert>
      ) : null}
      <div className="list" style={{ marginTop: me && !me.brand.name ? "1rem" : 0 }}>
        {projects.length === 0 ? (
          <EmptyState
            title="Пока нет проектов"
            description="Выберите формат, опишите тему и получите первый черновик."
            action={<PrimaryLink href="/create">Начать</PrimaryLink>}
          />
        ) : (
          projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <strong>{project.title}</strong>
              <div className="quiet">{labelOf(CONTENT_TYPES, project.contentType)}</div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
