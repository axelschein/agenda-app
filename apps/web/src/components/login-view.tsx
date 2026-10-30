"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_URL } from "./agenda-api";

/**
 * Isla cliente: formulario de inicio de sesión. Tras un login exitoso pide a
 * Next que vuelva a renderizar en el servidor (router.refresh), que ahora
 * resuelve la sesión y muestra el panel sin recargar la página entera.
 */
export function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(
          "El correo o la contraseña no son correctos, o la cuenta no está habilitada.",
        );
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setError(
        "No se pudo conectar con AgendaApp. Revisá que la API esté iniciada.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="login-layout" aria-labelledby="page-title">
        <div className="intro-panel">
          <Image className="login-logo" src="/agendaapp-icon.png" alt="" width={112} height={112} priority />
          <p className="eyebrow">AgendaApp</p>
          <h1 id="page-title">Tu agenda, en orden.</h1>
          <p className="intro">
            Ingresá para acceder a las funciones habilitadas para tu cuenta.
          </p>
        </div>
        <form className="login-card" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          <p className="form-help">
            Usá el correo y la contraseña de una cuenta habilitada.
          </p>
          <label htmlFor="email">Correo electrónico</label>
          <input
            autoComplete="username"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="password">Contraseña</label>
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
