# ContentPilot AI

Веб-приложение для черновиков маркетингового контента. Стек соответствует технической спецификации: Next.js, Turso/libSQL, Gemini, опционально Vercel Blob.

## Локальный запуск

```bash
npm install
npm run db:migrate
npm run dev
```

Откройте http://localhost:3000. Скопируйте `.env.example` в `.env`, если файла ещё нет, и укажите `GEMINI_API_KEY`. Без ключа регистрация, проекты и загрузка текста работают, а генерация возвращает понятную ошибку.

В режиме разработки ссылка сброса пароля показывается на экране восстановления. В production для писем нужны `RESEND_API_KEY` и `EMAIL_FROM`.

`ADMIN_EMAILS` — список адресов через запятую. Они получают доступ к сводке и квотам при регистрации.

## Деплой на Vercel + Turso

1. В [Turso](https://turso.tech) создайте базу или подключите **Turso Cloud** к проекту Vercel через Marketplace.
2. В Vercel → проект → **Settings → Environment Variables** для **Production** (и Preview при необходимости):
   - `TURSO_DATABASE_URL` — строка вида `libsql://…`
   - `TURSO_AUTH_TOKEN` — токен базы
   - `AUTH_SECRET` — случайная строка от 16 символов
   - `GEMINI_API_KEY` — ключ Google AI
   - `NEXT_PUBLIC_APP_URL` — URL сайта, например `https://conntent.vercel.app`
3. **Deployments → Redeploy** (переменные не подхватываются без пересборки).
4. Проверка: `GET /api/health` — `databaseMode: "turso"`, `ok: true`.

## Решения, которые спецификация оставляла открытыми

- Вход по email и паролю, сессия в httpOnly-cookie. Отдельный auth-сервис не требуется, данные лежат в той же базе.
- Файлы пишутся в `./storage`. На Vercel без `BLOB_READ_WRITE_TOKEN` оригиналы документов не сохраняются, а изображения не запускаются, пока не подключено хранилище.
- Эмбеддинги: `gemini-embedding-2`, 768 измерений. Поиск считает косинус в приложении и всегда фильтрует `workspace_id`. Векторный индекс Turso не создаётся, пока размерность не подтверждена на целевой базе.
- Квоты стартовые и меняются в админке. Это не тарифы.
- База знаний обрабатывается в том же запросе, с лимитом размера файла.

Идентификаторы моделей задаются переменными `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL` и `GEMINI_EMBEDDING_MODEL`. Перед production сверьте их с документацией Google.
