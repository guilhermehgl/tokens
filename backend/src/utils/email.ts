import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  attachments: Mail.Attachment[] = []
) => {
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

    console.log("Email enviado para:", to, "MessageId:", info.messageId);
  } catch (err) {
    console.error("Erro ao enviar email:", err);
    throw err;
  }
};
