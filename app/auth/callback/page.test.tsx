import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const replace = vi.fn();
const auth = { signInWithOAuth: vi.fn(), getSession: vi.fn() };
const google = vi.hoisted(() => ({ handleGoogleReturn: vi.fn() }));

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useEffect: (effect: () => void) => effect() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/lib/google-sign-in", async (original) => ({ ...(await original<typeof import("@/lib/google-sign-in")>()), ...google }));

vi.stubGlobal("window", { location: { search: "?code=1", hash: "#access_token=t" } });

const { default: GoogleCallbackPage } = await import("./page");

describe("tela de volta do Google", () => {
  test("termina a entrada com o endereço que o Google devolveu", () => {
    google.handleGoogleReturn.mockResolvedValue(null);
    const html = renderToStaticMarkup(<GoogleCallbackPage />);
    expect(html).toContain("Entrando com o Google...");
    expect(google.handleGoogleReturn).toHaveBeenCalledWith(auth, { search: "?code=1", hash: "#access_token=t" }, replace);
  });
});
