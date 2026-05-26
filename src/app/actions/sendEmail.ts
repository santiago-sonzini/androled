// actions/sendEmail.ts
"use server"; // Indica que se ejecutará en el servidor

import { env } from '@/env';
import nodemailer from 'nodemailer';

interface SendEmailData {
  to: string;
  subject: string;
  html: string;
}

// user: "agustincastellanofotografia@gmail.com",       // Tu nombre de usuario
//       pass: "mbpe lytz zeua uhwv", 


export async function sendEmail({ to, subject, html }: SendEmailData) {
  // Configura el transporte SMTP (puedes utilizar variables de entorno para mayor seguridad)
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,         // Por ejemplo, smtp.gmail.com
    port: Number(env.SMTP_PORT),   // Por ejemplo, 587
    secure: false,                         // true si usas el puerto 465
    auth: {
         // Tu contraseña
    //      user: "agustincastellanofotografia@gmail.com",       // Tu nombre de usuario
    // pass: "mbpe lytz zeua uhwv", 
      user: "vcxv.3005@gmail.com",       // Tu nombre de usuario
      pass: "viju hsem jiss loal", 
    },
  });

  // Configura el email que se enviará
  const info = await transporter.sendMail({
    from: `Invitaciones <vcxv.3005@gmail.com>`, // Remitente
    to,                                         // Destinatario
    subject,                                    // Asunto del correo
    html,                                       // Contenido del correo (en HTML)
  });

  console.log("Email enviado:", info.messageId);
  return info;
}


export async function sendEmailCaste({ to, subject, html }: SendEmailData) {
  // Configura el transporte SMTP (puedes utilizar variables de entorno para mayor seguridad)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,         // Por ejemplo, smtp.gmail.com
    port: Number(process.env.SMTP_PORT),   // Por ejemplo, 587
    secure: false,                         // true si usas el puerto 465
    auth: {
      user: "agustincastellanofotografia@gmail.com",       // Tu nombre de usuario
      pass: "mbpe lytz zeua uhwv",       // Tu contraseña
    },
  });

  // Configura el email que se enviará
  const info = await transporter.sendMail({
    from: `Tarjetas <agustincastellanofotografia@gmail.com>`, // Remitente
    to,                                         // Destinatario
    subject,                                    // Asunto del correo
    html,                                       // Contenido del correo (en HTML)
  });

  console.log("Email enviado:", info.messageId);
  return info;
}






