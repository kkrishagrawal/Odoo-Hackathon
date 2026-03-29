const nodemailer = require("nodemailer");

const { AppError } = require("../middleware/error.middleware");
const { env } = require("./env");

let transporter = null;

function asBool(value) {
  return value === "true";
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (asBool(env.SMTP_USE_JSON_TRANSPORT)) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: asBool(env.SMTP_SECURE),
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    return transporter;
  }

  if (env.NODE_ENV !== "production") {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    console.warn("SMTP is not configured. Falling back to JSON transport in development.");
    return transporter;
  }

  throw new AppError(
    500,
    "Email service is not configured. Set SMTP credentials in backend .env.",
    "EMAIL_NOT_CONFIGURED"
  );
}

async function sendUserCredentialsEmail({
  to,
  fullName,
  companyName,
  role,
  temporaryPassword,
  createdBy,
}) {
  const from = env.SMTP_FROM || env.SMTP_USER || "no-reply@odoo-hackathon.local";
  const subject = `${companyName} access credentials`;
  const signinUrl = `${env.FRONTEND_ORIGIN.replace(/\/+$/, "")}/signin`;
  const text = [
    `Hello ${fullName},`,
    "",
    `Your account has been created for ${companyName}.`,
    `Role: ${role}`,
    `Email: ${to}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    `Sign in: ${signinUrl}`,
    "Please sign in and reset your password as soon as possible.",
    `Created by: ${createdBy}`,
  ].join("\n");

  const html = `
    <p>Hello ${fullName},</p>
    <p>Your account has been created for <strong>${companyName}</strong>.</p>
    <p><strong>Role:</strong> ${role}<br/>
    <strong>Email:</strong> ${to}<br/>
    <strong>Temporary password:</strong> ${temporaryPassword}</p>
    <p><strong>Sign in:</strong> <a href="${signinUrl}">${signinUrl}</a></p>
    <p>Please sign in and reset your password as soon as possible.</p>
    <p>Created by: ${createdBy}</p>
  `;

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html,
  };

  let info;

  try {
    const activeTransporter = getTransporter();
    info = await activeTransporter.sendMail(mailOptions);
  } catch (error) {
    if (env.NODE_ENV === "production") {
      throw error;
    }

    console.warn("SMTP delivery failed in development. Falling back to JSON transport.", error);
    transporter = nodemailer.createTransport({ jsonTransport: true });
    info = await transporter.sendMail(mailOptions);
  }

  if (info.message && env.NODE_ENV !== "production") {
    console.log("Credential email preview:", info.message.toString());
  }

  return info;
}

module.exports = {
  sendUserCredentialsEmail,
};
