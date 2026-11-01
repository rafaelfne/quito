import { describe, expect, test, vi } from "vitest";

const auth = { signOut: vi.fn() };

vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const { SignOutButton } = await import("./sign-out-button");
const { sessionMessages } = await import("@/lib/session");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function click(onError: (message: string) => void) {
  const button = SignOutButton({ onError }) as React.ReactElement<{ onClick: () => void; children: string }>;
  button.props.onClick();
  return button;
}

describe("SignOutButton", () => {
  test("sai só deste aparelho", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    const onError = vi.fn();
    expect(click(onError).props.children).toBe("Sair deste aparelho");
    await settle();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(onError).not.toHaveBeenCalled();
  });

  test("avisa quando não deu para sair", async () => {
    auth.signOut.mockResolvedValue({ error: new Error("offline") });
    const onError = vi.fn();
    click(onError);
    await settle();
    expect(onError).toHaveBeenCalledWith(sessionMessages.signOutFailed);
  });
});
