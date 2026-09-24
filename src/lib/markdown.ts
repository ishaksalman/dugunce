import { marked } from "marked";

/**
 * Rehber yazılarının markdown içeriğini HTML'e çevirir.
 *
 * Yalnızca ADMİN yazıyor — mekan sahibi ya da anonim kullanıcı girdisi
 * değil, o yüzden ayrı bir HTML temizleme (sanitize) katmanı yok; güven
 * sınırı admin'in zaten veritabanına yazma yetkisiyle aynı.
 */
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true });
}
