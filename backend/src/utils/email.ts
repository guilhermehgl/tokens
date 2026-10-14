import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

export function validateEmailConfiguration() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !/^\d+$/.test(process.env.SMTP_PORT || "") || Number(process.env.SMTP_PORT) < 1 || Number(process.env.SMTP_PORT) > 65535) {
    throw new Error("Configure o serviço SMTP antes de habilitar o envio de e-mails.");
  }
}

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  attachments: Mail.Attachment[] = []
) => {
  validateEmailConfiguration();
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true, // true se usar 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html, // agora usamos HTML no corpo do email
      attachments, // opcional, se você quiser mandar logo/imagem
    })

    console.log("Entrega de e-mail aceita pelo servidor SMTP.");
  } catch (err) {
    console.error("Falha na entrega por SMTP.");
    throw err;
  }
};
