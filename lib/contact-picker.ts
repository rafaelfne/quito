export type PickedContact = { name?: string[]; tel?: string[] };

export type ContactsPicker = {
  select: (properties: ("name" | "tel")[], options: { multiple: boolean }) => Promise<PickedContact[]>;
};

export type PickResult = { ok: true; contacts: PickedContact[] } | { ok: false };

type NavigatorWithContacts = { contacts?: { select?: unknown } };

export function contactsPickerOf(navigatorLike: unknown): ContactsPicker | null {
  const contacts = (navigatorLike as NavigatorWithContacts | null | undefined)?.contacts;
  return typeof contacts?.select === "function" ? (contacts as ContactsPicker) : null;
}

export async function pickContacts(picker: ContactsPicker): Promise<PickResult> {
  try {
    const contacts = await picker.select(["name", "tel"], { multiple: true });
    return { ok: true, contacts: Array.isArray(contacts) ? contacts : [] };
  } catch {
    return { ok: false };
  }
}

function firstFilled(values: string[] | undefined): string {
  return values?.map((value) => value.replace(/[\t;|,\r\n]+/g, " ").trim().replace(/\s+/g, " ")).find(Boolean) ?? "";
}

export function contactLine(contact: PickedContact): string {
  const guardianName = firstFilled(contact.name);
  const phone = firstFilled(contact.tel);
  return [", ", guardianName, phone ? `, ${phone}` : ""].join("");
}

export function appendContactLines(text: string, contacts: PickedContact[]): string {
  const lines = contacts.map(contactLine);
  const kept = text.replace(/\s+$/, "");
  return [kept, ...lines].filter(Boolean).join("\n");
}
