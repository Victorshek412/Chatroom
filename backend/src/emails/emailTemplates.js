export function createWelcomeEmailTemplate(name, clientURL) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Whisper</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #EBEBEB; max-width: 560px; margin: 0 auto; padding: 32px 16px; background-color: #0D0D0D;">
  <div style="background-color: #171717; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.08);">
    <div style="background-color: #212121; padding: 34px 40px 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <div style="width: 48px; height: 48px; margin: 0 auto 14px; background-color: rgba(255,255,255,0.08); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#D4D4D4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 style="color: #EBEBEB; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em;">Welcome to Whisper</h1>
      <p style="color: #585858; margin: 6px 0 0; font-size: 13px; font-weight: 400;">Secure, minimal messaging</p>
    </div>

    <div style="padding: 36px 40px 32px;">
      <p style="font-size: 15px; font-weight: 600; color: #EBEBEB; margin: 0 0 6px; letter-spacing: -0.01em;">Hello ${name},</p>
      <p style="font-size: 13.5px; color: #909090; margin: 0 0 28px; line-height: 1.7;">
        We're excited to have you join Whisper. Connect with friends, family, and colleagues in real-time — privately and effortlessly.
      </p>

      <div style="background-color: #1E1E1E; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 22px 24px; margin-bottom: 28px;">
        <p style="font-size: 13px; font-weight: 600; color: #EBEBEB; margin: 0 0 16px; letter-spacing: -0.01em;">Get started</p>

        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 0 0 14px; vertical-align: top; width: 24px;">
              <div style="width: 20px; height: 20px; border-radius: 6px; background-color: #2A2A2A; text-align: center; line-height: 20px; font-size: 10px; font-weight: 600; color: #909090;">1</div>
            </td>
            <td style="padding: 0 0 14px 10px; vertical-align: top;">
              <p style="margin: 0; font-size: 13px; color: #EBEBEB; font-weight: 500; letter-spacing: -0.01em;">Set up your profile</p>
              <p style="margin: 3px 0 0; font-size: 11.5px; color: #585858; line-height: 1.5;">Add a photo and display name</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 14px; vertical-align: top; width: 24px;">
              <div style="width: 20px; height: 20px; border-radius: 6px; background-color: #2A2A2A; text-align: center; line-height: 20px; font-size: 10px; font-weight: 600; color: #909090;">2</div>
            </td>
            <td style="padding: 0 0 14px 10px; vertical-align: top;">
              <p style="margin: 0; font-size: 13px; color: #EBEBEB; font-weight: 500; letter-spacing: -0.01em;">Find your contacts</p>
              <p style="margin: 3px 0 0; font-size: 11.5px; color: #585858; line-height: 1.5;">Search by User ID or name</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 14px; vertical-align: top; width: 24px;">
              <div style="width: 20px; height: 20px; border-radius: 6px; background-color: #2A2A2A; text-align: center; line-height: 20px; font-size: 10px; font-weight: 600; color: #909090;">3</div>
            </td>
            <td style="padding: 0 0 14px 10px; vertical-align: top;">
              <p style="margin: 0; font-size: 13px; color: #EBEBEB; font-weight: 500; letter-spacing: -0.01em;">Start a conversation</p>
              <p style="margin: 3px 0 0; font-size: 11.5px; color: #585858; line-height: 1.5;">Send messages, images, and files</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0; vertical-align: top; width: 24px;">
              <div style="width: 20px; height: 20px; border-radius: 6px; background-color: #2A2A2A; text-align: center; line-height: 20px; font-size: 10px; font-weight: 600; color: #909090;">4</div>
            </td>
            <td style="padding: 0 0 0 10px; vertical-align: top;">
              <p style="margin: 0; font-size: 13px; color: #EBEBEB; font-weight: 500; letter-spacing: -0.01em;">Create a group</p>
              <p style="margin: 3px 0 0; font-size: 11.5px; color: #585858; line-height: 1.5;">Chat with multiple people at once</p>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${clientURL}" style="display: inline-block; background-color: #E2E2E2; color: #111111; text-decoration: none; padding: 11px 36px; border-radius: 10px; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Open Whisper</a>
      </div>

      <div style="height: 1px; background-color: rgba(255,255,255,0.06); margin-bottom: 20px;"></div>

      <p style="font-size: 12.5px; color: #585858; margin: 0 0 4px; line-height: 1.7;">
        If you need any help, reply to this email — we're always here.
      </p>
      <p style="font-size: 12.5px; color: #909090; margin: 16px 0 0; font-weight: 500;">
        — The Whisper Team
      </p>
    </div>
  </div>

  <div style="text-align: center; padding: 24px 16px 8px;">
    <p style="font-size: 11px; color: #585858; margin: 0 0 8px;">&copy; ${new Date().getFullYear()} Whisper. All rights reserved.</p>
    <p style="margin: 0;">
      <a href="#" style="color: #909090; text-decoration: none; font-size: 11px; margin: 0 8px;">Privacy</a>
      <span style="color: rgba(255,255,255,0.08); font-size: 10px;">&middot;</span>
      <a href="#" style="color: #909090; text-decoration: none; font-size: 11px; margin: 0 8px;">Terms</a>
      <span style="color: rgba(255,255,255,0.08); font-size: 10px;">&middot;</span>
      <a href="#" style="color: #909090; text-decoration: none; font-size: 11px; margin: 0 8px;">Contact</a>
    </p>
  </div>
</body>
</html>`;
}
