import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" className="wordmark">
          Content<span>Pilot</span>
        </Link>
        <nav className="nav-row">
          <Link href="/login">Войти</Link>
          <Link className="btn" href="/register">
            Попробовать
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="hero-badge">Черновики под ваш бренд</p>
            <h1>Текст, который можно сразу править</h1>
            <p className="lede">
              Опишите задачу обычным языком. ContentPilot соберёт пост, объявление, описание или сценарий короткого видео — с версиями, правками и экспортом.
            </p>
            <div className="hero-actions row">
              <Link className="btn" href="/register">
                Создать первый черновик
              </Link>
              <Link className="btn-ghost" href="/login">
                У меня уже есть аккаунт
              </Link>
            </div>
          </div>
          <article className="draft" aria-label="Пример структуры черновика">
            <small>Пример результата, не обещание охвата</small>
            <h2>Тихий час в мастерской</h2>
            <p>Откройте запись на субботу, пока в расписании ещё есть окно.</p>
            <p>
              Расскажите, для кого изделие и что человек уносит с собой. Цену поставьте сами: если её нет в материалах, черновик оставит пометку, а не выдумает цифру.
            </p>
            <p>
              <strong>Записаться на субботу</strong>
            </p>
          </article>
        </section>
        <section className="section">
          <h2>От профиля бренда до файла, который можно забрать</h2>
          <div className="steps">
            <article className="step-card">
              <h3>Один раз описываете бренд</h3>
              <p className="muted">Ниша, аудитория, тон, призыв и слова, которые нельзя использовать. Дальше это подставляется само.</p>
            </article>
            <article className="step-card">
              <h3>Добавляете свои факты</h3>
              <p className="muted">Заметка, PDF или DOCX становятся базой знаний. В ответе видно, какой фрагмент пригодился.</p>
            </article>
            <article className="step-card">
              <h3>Правите и забираете текст</h3>
              <p className="muted">Команда «сделай короче» создаёт новую версию. Публикацию в соцсети приложение не делает.</p>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span className="quiet">Черновики для русского и узбекского контента</span>
        <nav className="nav-row">
          <Link href="/legal/terms">Условия</Link>
          <Link href="/legal/privacy">Конфиденциальность</Link>
        </nav>
      </footer>
    </>
  );
}
