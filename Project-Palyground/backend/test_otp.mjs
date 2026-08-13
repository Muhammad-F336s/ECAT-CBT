import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const t = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

console.log('Sending test OTP email to:', process.env.EMAIL_USER);

try {
  const info = await t.sendMail({
    from: `ECAT CBT Platform <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: 'ECAT CBT - OTP Test',
    html: `<div style="font-family:Arial;padding:20px"><h2>OTP Test</h2><p>Your test OTP is: <strong style="font-size:2rem;color:#1b4332;letter-spacing:8px">654321</strong></p></div>`
  });
  console.log('SUCCESS! Message ID:', info.messageId);
  console.log('Accepted:', info.accepted);
  console.log('Rejected:', info.rejected);
} catch(err) {
  console.error('FAILED:', err.message);
  console.error('Code:', err.code);
  console.error('Response:', err.response);
}
