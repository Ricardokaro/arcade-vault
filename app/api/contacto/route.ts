import { Resend } from "resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactBody = {
  name?: unknown;
  email?: unknown;
  msg?: unknown;
  honeypot?: unknown;
};

export async function POST(request: Request) {
  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const msg = typeof body.msg === "string" ? body.msg.trim() : "";
  const honeypot = typeof body.honeypot === "string" ? body.honeypot.trim() : "";

  if (!name || !email || !msg) {
    return Response.json({ error: "Faltan campos requeridos." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "El correo electrónico no es válido." }, { status: 400 });
  }

  // El honeypot solo lo rellenan bots; se descarta sin avisar para no delatar la protección.
  if (honeypot) {
    return Response.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !toEmail) {
    return Response.json({ error: "El servicio de correo no está configurado." }, { status: 502 });
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Arcade Vault <onboarding@resend.dev>",
    to: toEmail,
    replyTo: email,
    subject: `[Contacto Arcade Vault] ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
  });

  if (error) {
    return Response.json({ error: "No se pudo enviar el mensaje." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
