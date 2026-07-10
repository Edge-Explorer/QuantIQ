import smtplib
import logging
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.app.config.settings import settings

logger = logging.getLogger("quantiq.email")

def send_price_alert_email(to_email: str, ticker: str, condition: str, target_price: float, current_price: float) -> bool:
    """
    Sends a price alert notification email using SMTP config, or logs to console as a fallback.
    """
    subject = f"[QuantIQ Alert] Price Target Reached for {ticker.upper()}"
    
    # HTML Content
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #06070d; color: #f1f5f9; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0d101b; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 32px; box-sizing: border-box;">
          <h2 style="color: #00f2fe; margin-top: 0; font-size: 24px; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 16px;">
            QuantIQ Alert Triggered
          </h2>
          
          <p style="font-size: 16px; line-height: 150%;">
            Dear Valued Trader,
          </p>
          
          <p style="font-size: 15px; line-height: 150%;">
            We are pleased to inform you that your price alert for <strong>{ticker.upper()}</strong> has been triggered!
          </p>
          
          <div style="background: rgba(0, 242, 254, 0.05); border-left: 4px solid #00f2fe; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
            <table style="width: 100%; font-size: 14px; color: #94a3b8; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #f1f5f9; width: 140px;">Asset Ticker:</td>
                <td style="padding: 6px 0; color: #00f2fe; font-weight: bold;">{ticker.upper()}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #f1f5f9;">Your Target Price:</td>
                <td style="padding: 6px 0; color: #f1f5f9;">${target_price:.2f} ({condition.upper()})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #f1f5f9;">Trigger Price:</td>
                <td style="padding: 6px 0; color: #00e676; font-weight: bold;">${current_price:.2f}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 13px; line-height: 150%; color: #ef4444; border-top: 1px dashed rgba(255,255,255,0.07); padding-top: 16px;">
            <strong>⚠️ Capital Risk Alert:</strong> To keep your investments secure, we will notify you every 2 minutes. Please log into your QuantIQ dashboard to deactivate or delete this alert and stop future email reminders.
          </p>
          
          <p style="font-size: 12px; color: #475569; margin-top: 32px; text-align: center;">
            &copy; {datetime.datetime.now().year} QuantIQ. All rights reserved.
          </p>
        </div>
      </body>
    </html>
    """

    # Plain text fallback
    text_content = (
        f"Dear Valued Trader,\n\n"
        f"Your price alert for {ticker.upper()} has been triggered!\n\n"
        f"Asset: {ticker.upper()}\n"
        f"Target Price: ${target_price:.2f} ({condition.upper()})\n"
        f"Trigger Price: ${current_price:.2f}\n\n"
        f"Risk Alert: To keep your investments secure, we will notify you every 2 minutes. "
        f"Log into your QuantIQ dashboard to deactivate or delete this alert and stop future email reminders.\n\n"
        f"Best regards,\n"
        f"QuantIQ Team"
    )

    # Logging to console as development/fallback visualization
    logger.info(f"\n========================================\n"
                f"[EMAIL CONSOLE LOG] Dispatching to: {to_email}\n"
                f"Subject: {subject}\n"
                f"----------------------------------------\n"
                f"{text_content}\n"
                f"========================================")

    # Check if SMTP configuration is available
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. E-mail simulated via logs above.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Connect and send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
        logger.info(f"Successfully sent price alert email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via SMTP host {settings.SMTP_HOST}: {e}")
        return False


def send_verification_email(to_email: str, code: str) -> bool:
    """
    Sends a registration verification OTP email using SMTP config, or logs to console as a fallback.
    """
    subject = "[QuantIQ] Verify your email address"
    
    # HTML Content
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #06070d; color: #f1f5f9; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0d101b; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 32px; box-sizing: border-box;">
          <h2 style="color: #00f2fe; margin-top: 0; font-size: 24px; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 16px;">
            Verify Your Email
          </h2>
          
          <p style="font-size: 16px; line-height: 150%;">
            Welcome to QuantIQ!
          </p>
          
          <p style="font-size: 15px; line-height: 150%;">
            Thank you for signing up. Please enter the following 6-digit verification code to complete your registration and activate your terminal account:
          </p>
          
          <div style="background: rgba(0, 242, 254, 0.05); border: 1px dashed #00f2fe; padding: 20px; margin: 24px 0; border-radius: 8px; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; color: #00f2fe; letter-spacing: 0.2em; font-family: monospace;">{code}</span>
          </div>
          
          <p style="font-size: 14px; line-height: 150%; color: #94a3b8;">
            This verification code is active for 15 minutes. If you did not request this code, you can safely ignore this email.
          </p>
          
          <p style="font-size: 12px; color: #475569; margin-top: 32px; text-align: center; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 16px;">
            &copy; {datetime.datetime.now().year} QuantIQ. All rights reserved.
          </p>
        </div>
      </body>
    </html>
    """

    # Plain text fallback
    text_content = (
        f"Welcome to QuantIQ!\n\n"
        f"Please enter the following 6-digit verification code to complete your registration:\n\n"
        f"{code}\n\n"
        f"This code is active for 15 minutes. If you did not request this, you can safely ignore this email.\n\n"
        f"Best regards,\n"
        f"QuantIQ Team"
    )

    # Logging to console
    logger.info(f"\n========================================\n"
                f"[EMAIL CONSOLE LOG] Dispatching to: {to_email}\n"
                f"Subject: {subject}\n"
                f"----------------------------------------\n"
                f"{text_content}\n"
                f"========================================")

    # Check if SMTP configuration is available
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. Verification e-mail simulated via logs above.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Connect and send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
        logger.info(f"Successfully sent verification email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email via SMTP host {settings.SMTP_HOST}: {e}")
        return False
