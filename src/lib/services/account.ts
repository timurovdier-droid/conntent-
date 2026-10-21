import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/token";
import {
  consumeResetToken,
  deleteUserData,
  findBrand,
  findUserByEmail,
  findUserById,
  findWorkspaceByOwner,
  insertAudit,
  insertProductEvent,
  insertResetToken,
  insertUser,
  insertWorkspace,
  newId,
  randomToken,
  saveBrand,
  sha256,
  updateUser,
  type UserRow,
} from "@/lib/db/repo";
import { deletePrivate } from "@/lib/storage/files";
import { quotaSnapshot } from "@/lib/services/quota";
import type { BrandInput, Me } from "@/lib/types";

const emptyBrand = (): BrandInput => ({
  name: "",
  niche: "",
  products: [],
  audience: "",
  tone: "",
  language: "ru",
  valueProposition: "",
  ctaDefaults: [],
  forbiddenTerms: [],
});

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function registerAccount(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  if (await findUserByEmail(email)) {
    throw new AppError("Аккаунт с таким email уже есть.", 409, "EMAIL_TAKEN");
  }
  const id = newId();
  await insertUser({
    id,
    email,
    passwordHash: await hashPassword(password),
    locale: "ru",
    isAdmin: adminEmails().includes(email),
  });
  const workspaceId = newId();
  await insertWorkspace(workspaceId, id, "Моё пространство");
  await saveBrand(workspaceId, emptyBrand());
  await insertProductEvent(id, "registered", null);
  const user = await findUserById(id);
  if (!user) throw new AppError("Не удалось создать аккаунт.", 500, "INTERNAL");
  return user;
}

export async function loginAccount(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await findUserByEmail(email);
  const matches = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !matches || user.status !== "active") {
    throw new AppError("Неверный email или пароль.", 401, "INVALID_LOGIN");
  }
  return user;
}

export async function sessionFor(user: UserRow) {
  return signSession({ id: user.id, email: user.email });
}

export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (!user || user.status !== "active") return { devResetUrl: null as string | null };
  const token = randomToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await insertResetToken(newId(), user.id, sha256(token), expires);
  const resetUrl = `${config.appUrl.replace(/\/$/, "")}/reset?token=${encodeURIComponent(token)}`;
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [user.email],
        subject: "Сброс пароля ContentPilot",
        text: `Чтобы задать новый пароль, откройте ссылку в течение часа:\n${resetUrl}\n\nЕсли вы не запрашивали сброс, проигнорируйте письмо.`,
      }),
    });
    return { devResetUrl: null };
  }
  if (process.env.NODE_ENV !== "production") return { devResetUrl: resetUrl };
  return { devResetUrl: null };
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeResetToken(sha256(token));
  if (!userId) throw new AppError("Ссылка недействительна или устарела.", 400, "RESET_INVALID");
  await updateUser(userId, { passwordHash: await hashPassword(password) });
}

export async function requireWorkspace(userId: string) {
  const workspace = await findWorkspaceByOwner(userId);
  if (!workspace) throw new AppError("Рабочее пространство не найдено.", 404, "NOT_FOUND");
  return workspace;
}

export async function mePayload(user: UserRow): Promise<Me> {
  const workspace = await requireWorkspace(user.id);
  const brand = await findBrand(workspace.id);
  return {
    user: { id: user.id, email: user.email, locale: user.locale, isAdmin: user.isAdmin },
    workspace: { id: workspace.id, name: workspace.name },
    brand,
    quota: await quotaSnapshot(user.id),
  };
}

export async function deleteAccount(user: UserRow, password: string) {
  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) throw new AppError("Пароль не подошёл.", 403, "INVALID_PASSWORD");
  await insertAudit(user.id, "delete_account", "user", user.id);
  const keys = await deleteUserData(user.id);
  await Promise.all(keys.map((key) => deletePrivate(key)));
}
