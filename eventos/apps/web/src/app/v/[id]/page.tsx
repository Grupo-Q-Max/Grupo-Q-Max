import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ShortValidationRedirectPage({ params }: Props) {
  const { id } = await params;
  const cleanId = (id || "").trim();
  redirect(`/validar-whatsapp?token=${encodeURIComponent(cleanId)}`);
}
