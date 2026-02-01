import { Resend } from "resend";
import { ENV } from "../lib/env.js";
dotenv.config();

export const resendClient = new Resend(ENV.RESEND_API_KEY);
// Initialize Resend client with API key from environment variables

export const sender = {
  email: ENV.EMAIL_FROM,
  name: ENV.EMAIL_FROM_NAME,
};
// Explain the difference between sender and resendClient step by step:
// 1. resendClient is an instance of the Resend class, which is used to interact with the Resend email service API. It requires an API key for authentication,
// which is provided through environment variables.
// 2. sender is a simple object that contains the email address and name of the sender.
// This information is typically used when sending emails to specify who the email is from.
// 3. In summary, resendClient is used to send emails through the Resend service, while sender provides the necessary sender information for those emails.
