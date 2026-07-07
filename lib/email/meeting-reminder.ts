import 'server-only';
import { getResend } from './client';

const FROM = 'RoleBoost <transcripts@roleboost.app>';

interface MeetingReminderEmail {
  candidateName: string;
  candidateEmail: string | null;
  recruiterEmail: string;
  recruiterName?: string | null;
  availability: string;
  /** Whole days the request has been sitting unactioned, for the copy. */
  ageDays: number;
  /** Absolute URL to the candidate's meeting-requests dashboard. */
  actionUrl: string;
}

/**
 * Nudges the candidate about a meeting request that is still marked "new" a
 * couple of days after a recruiter submitted it. Best-effort: callers must not
 * fail the sweep if this throws. No-op when there is no candidate email.
 *
 * This is the follow-through on the highest-intent signal on the platform: a
 * recruiter who asked to talk. A dropped request is a dropped hire, so a single
 * reminder is worth far more than the send cost.
 */
export async function sendMeetingReminderEmail({
  candidateName,
  candidateEmail,
  recruiterEmail,
  recruiterName,
  availability,
  ageDays,
  actionUrl,
}: MeetingReminderEmail): Promise<void> {
  if (!candidateEmail) return;
  const resend = getResend();
  const who = recruiterName?.trim() ? `${recruiterName.trim()} (${recruiterEmail})` : recruiterEmail;
  const waited = ageDays <= 1 ? 'a day' : `${ageDays} days`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1E3A5F; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">A recruiter is still waiting to hear from you</h2>
      <p>${escapeHtml(who)} asked to meet with you through your RoleBoost Personal Assistant, and the request has been open for ${escapeHtml(waited)}.</p>
      <p><strong>Their availability:</strong></p>
      <p style="white-space: pre-wrap; background: #F5F0E8; padding: 12px; border-radius: 8px;">${escapeHtml(availability)}</p>
      <p style="margin: 20px 0;">
        <a href="${escapeAttr(actionUrl)}" style="display: inline-block; background: #1E3A5F; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px;">Review the request</a>
      </p>
      <p style="color: #4B6580; font-size: 14px;">Or just reply to ${escapeHtml(recruiterEmail)} to lock in a time. This is the only reminder we'll send for this request.</p>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: candidateEmail,
    replyTo: recruiterEmail,
    subject: `Still open: meeting request from ${recruiterName?.trim() || recruiterEmail}`,
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

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
