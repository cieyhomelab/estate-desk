import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { createClient } from "@/lib/supabase";

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
}

const SYSTEM_PROMPT =
  'Jesteś asystentem formatowania adresów w Polsce. Przekształć podany adres do kanonicznej formy polskiej: prefiks "ul." przed nazwą ulicy (jeśli to ulica), kod pocztowy w formacie NN-NNN, nazwa dzielnicy w nawiasie okrągłym na końcu. Zwróć TYLKO sformatowany adres — żadnego dodatkowego tekstu, wyjaśnień ani cudzysłowów.';

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Błąd konfiguracji bazy danych" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Wymagane logowanie" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "Formatowanie niedostępne — brak klucza API" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let raw: string;
  try {
    const body = (await context.request.json()) as { raw?: unknown };
    const rawValue = body.raw;
    if (typeof rawValue !== "string") {
      return new Response(JSON.stringify({ error: "Brak adresu" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    raw = rawValue;
  } catch {
    return new Response(JSON.stringify({ error: "Brak adresu" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return new Response(JSON.stringify({ error: "Brak adresu" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);

  let openRouterResponse: Response;
  try {
    openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: raw },
        ],
      }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    return new Response(
      JSON.stringify({
        error: "Formatowanie trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie.",
      }),
      { status: 504, headers: { "Content-Type": "application/json" } },
    );
  }

  clearTimeout(timeout);

  if (!openRouterResponse.ok) {
    return new Response(JSON.stringify({ error: "Błąd zewnętrznego serwisu formatowania adresu." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = (await openRouterResponse.json()) as OpenRouterResponse;
  const formatted = data.choices?.[0]?.message?.content?.trim();

  if (!formatted) {
    return new Response(JSON.stringify({ error: "Błąd zewnętrznego serwisu formatowania adresu." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ formatted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
