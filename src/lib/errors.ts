/** Sunucu eylemlerinin tek dönüş tipi. İstemci her zaman bu şekli bekler. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function actionOk(): ActionResult;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionError(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

/**
 * Ham veritabanı/altyapı hatası kullanıcıya gösterilmez; loglanır ve
 * yerine genel bir mesaj döner. Hassas veri log'a da girmemeli.
 */
export function unexpectedError(context: string, error: unknown): ActionResult<never> {
  console.error(`[${context}]`, error instanceof Error ? error.message : error);
  return {
    ok: false,
    message: "Beklenmeyen bir hata oluştu. Lütfen biraz sonra tekrar deneyin.",
  };
}

/**
 * Zod hatasını alan → mesaj sözlüğüne çevirir. İlk hata kazanır: kullanıcıya
 * bir alanda üst üste üç uyarı göstermenin faydası yok.
 */
export function fieldErrorsOf(
  error: { issues: { path: PropertyKey[]; message: string }[] },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Form gönderimlerinin ortak "düzeltin" yanıtı. */
export function invalidInput(
  error: Parameters<typeof fieldErrorsOf>[0],
): ActionResult<never> {
  return actionError("Lütfen formdaki hataları düzeltin.", fieldErrorsOf(error));
}
