import { AxiosError } from "axios";

/** Extrait un code d'erreur stable depuis une erreur axios, traduit via t(`errors.<code>`). */
export function errorCode(err: unknown): string {
  if (err instanceof AxiosError) {
    if (err.response?.data?.code) return String(err.response.data.code);
    if (err.code === "ERR_NETWORK") return "NETWORK";
  }
  return "UNKNOWN";
}
