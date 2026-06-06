import { useState, useRef, useEffect } from "react";

interface Props {
  initialValue?: string;
  placeholder?: string;
  id?: string;
  name?: string;
}

type Status = "idle" | "loading" | "error";

export default function AddressField({ initialValue = "", placeholder, id, name = "address" }: Props) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  async function triggerFormat() {
    if (status === "loading") return;
    if (!value.trim()) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/format-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: value }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = (await res.json()) as { formatted?: string; error?: string };

      if (res.ok && data.formatted) {
        setValue(data.formatted);
        setStatus("idle");
      } else {
        setStatus("error");
        setErrorMessage(data.error ?? "Wystąpił błąd podczas formatowania adresu.");
      }
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") {
        setStatus("error");
        setErrorMessage("Formatowanie trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie.");
      } else {
        setStatus("error");
        setErrorMessage("Wystąpił błąd podczas formatowania adresu.");
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void triggerFormat();
    }
  }

  const isLoading = status === "loading";

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          id={id}
          name={name}
          required
          maxLength={500}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/30 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={triggerFormat}
          disabled={isLoading}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Formatuje…" : "Formatuj"}
        </button>
      </div>
      <p className="mt-1 text-xs text-white/40">
        Naciśnij Enter lub kliknij Formatuj, aby sformatować adres do formy kanonicznej.
      </p>
      {status === "error" && <p className="mt-1 text-xs text-red-400">{errorMessage}</p>}
    </div>
  );
}
