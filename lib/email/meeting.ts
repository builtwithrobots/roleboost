import 'server-only';
import { getResend } from './client';

const FROM = 'RoleBoost <transcripts@roleboost.app>';

interface MeetingRequestEmail {
  candidateName: string;
  candidateEmail: string | null;
  recruiterEmail: string;
  recruiterName?: string | null;
  availability: string;
}

/**
 * Emails the candidate when a recruiter requests a live meeting through their
 * Personal Assistant. Best-effort: callers should not fail the request if this
 * throws. No-op when there is no candidate email.
 */
export async function sendMeetingRequestEmail({
  candidateName,
  candidateEmail,
  recruiterEmail,
  recruiterName,
  availability,
}: MeetingRequestEmail): Promise<void> {
  if (!candidateEmail) return;
  const resend = getResend();
  const who = recruiterName?.trim() ? `${recruiterName.trim()} (${recruiterEmail})` : recruiterEmail;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1E3A5F; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">New meeting request</h2>
      <p>A recruiter asked to meet with you through your RoleBoost Personal Assistant.</p>
      <p><strong>From:</strong> ${escapeHtml(who)}</p>
      <p><strong>Their availability:</strong></p>
      <p style="white-space: pre-wrap; background: #F5F0E8; padding: 12px; border-radius: 8px;">${escapeHtml(availability)}</p>
      <p>Reply to ${escapeHtml(recruiterEmail)} to lock in a time.</p>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: candidateEmail,
    replyTo: recruiterEmail,
    subject: `Meeting request from ${recruiterName?.trim() || recruiterEmail}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
