import "server-only";

/**
 * Sahiplenilmemiş bir mekana talep geldiğinde admin'e anlık bildirim.
 *
 * Otomatik olarak İŞLETMEYE mesaj ATMIYORUZ — sahibinin izni olmadan
 * SMS/WhatsApp/e-posta ile ticari ileti göndermek KVKK/İYS mevzuatına
 * aykırı. Bunun yerine admin'e haber veriyoruz; ilk teması admin KİŞİSEL
 * olarak (arayarak) kuruyor. Bkz. lib/actions/inquiry.ts.
 *
 * Kurulmamışsa (env eksikse) sessizce hiçbir şey yapmaz — bildirim asla
 * asıl talep akışını BLOKLAMAZ, yalnızca best-effort bir yan etkidir.
 */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      console.error("notifyTelegram: Telegram API hatası", r.status, await r.text());
    }
  } catch (error) {
    // Bildirim başarısız olsa bile talep zaten kaydedildi — burada
    // sessizce logluyoruz, kullanıcıya asla hata göstermiyoruz.
    console.error("notifyTelegram: gönderilemedi", error);
  }
}
