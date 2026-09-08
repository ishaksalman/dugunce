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
