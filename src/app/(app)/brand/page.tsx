"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { LANGUAGES } from "@/lib/constants";
import type { BrandInput } from "@/lib/types";

const empty: BrandInput = {
  name: "",
  niche: "",
  products: [],
  audience: "",
  tone: "",
  language: "ru",
  valueProposition: "",
  ctaDefaults: [],
  forbiddenTerms: [],
};

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function BrandPage() {
  const [brand, setBrand] = useState<BrandInput>(empty);
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<BrandInput>("/api/brand")
      .then((next) => {
        setBrand(next);
        setFormKey((value) => value + 1);
      })
      .catch((caught) => setError(caught.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const next: BrandInput = {
      name: String(form.get("name") || ""),
      niche: String(form.get("niche") || ""),
      products: lines(String(form.get("products") || "")),
      audience: String(form.get("audience") || ""),
      tone: String(form.get("tone") || ""),
      language: String(form.get("language") || "ru") as BrandInput["language"],
      valueProposition: String(form.get("valueProposition") || ""),
      ctaDefaults: lines(String(form.get("cta") || "")),
      forbiddenTerms: lines(String(form.get("forbidden") || "")),
    };
    try {
      await api("/api/brand", { method: "PUT", json: next });
      setBrand(next);
      setMessage("Профиль сохранён и будет использоваться в новых черновиках.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить.");
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Профиль бренда</h1>
          <p className="quiet">Необязательные поля можно оставить пустыми.</p>
        </div>
      </div>
      <form key={formKey} className="panel stack" style={{ width: "min(100%, 760px)" }} onSubmit={onSubmit}>
        {error ? <div className="alert">{error}</div> : null}
        {message ? <div className="alert ok">{message}</div> : null}
        <label>
          Название
          <input name="name" defaultValue={brand.name} />
        </label>
        <div className="form-row" style={{ alignItems: "stretch" }}>
          <label style={{ flex: 1 }}>
            Ниша
            <input name="niche" defaultValue={brand.niche} />
          </label>
          <label style={{ flex: 1 }}>
            Язык по умолчанию
            <select name="language" defaultValue={brand.language}>
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Продукты или услуги, каждый с новой строки
          <textarea name="products" defaultValue={brand.products.join("\n")} />
        </label>
        <label>
          Аудитория
          <textarea name="audience" defaultValue={brand.audience} />
        </label>
        <label>
          Тон
          <input name="tone" defaultValue={brand.tone} placeholder="спокойный, конкретный" />
        </label>
        <label>
          Чем вы полезны
          <textarea name="valueProposition" defaultValue={brand.valueProposition} />
        </label>
        <label>
          Обычные призывы, каждый с новой строки
          <textarea name="cta" defaultValue={brand.ctaDefaults.join("\n")} />
        </label>
        <label>
          Запрещённые формулировки, каждая с новой строки
          <textarea name="forbidden" defaultValue={brand.forbiddenTerms.join("\n")} />
        </label>
        <button className="btn" type="submit">
          Сохранить бренд
        </button>
      </form>
    </>
  );
}
