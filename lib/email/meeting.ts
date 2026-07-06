import 'server-only';
import { getResend } from './client';
import type { ChatTurn } from '@/lib/types';

const FROM = 'RoleBoost <transcripts@roleboost.app>';

interface MeetingRequestEmail {
  candidateName: string;
  candidateEmail: string | null;
  recruiterEmail: string;
  recruiterName?: string | null;
  availability: string;
  /** The conversation that led to the request, so the candidate walks in prepared. */
  messages?: ChatTurn[];
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
  messages,
}: MeetingRequestEmail): Promise<void> {
  if (!candidateEmail) return;
  const resend = getResend();
  const who = recruiterName?.trim() ? `${recruiterName.trim()} (${recruiterEmail})` : recruiterEmail;

  // The conversation that prompted the request, so the candidate can bring notes
  // into the live meeting (the promise the assistant makes to the recruiter).
  const transcriptBlock =
    messages && messages.length > 0
      ? `
      <p style="margin: 20px 0 6px;"><strong>The conversation that led here:</strong></p>
      <div style="background: #fff; border: 1px solid #E8E0D4; border-radius: 8px; padding: 14px;">
        ${messages
          .map((m) => {
            const label = m.role === 'user' ? 'Recruiter' : `${candidateName}'s AI`;
            const color = m.role === 'user' ? '#4B6580' : '#1E3A5F';
            return `<p style="margin:0 0 12px;line-height:1.5"><strong style="color:${color}">${escapeHtml(label)}</strong><br>${escapeHtml(m.content).replace(/\n/g, '<br>')}</p>`;
          })
          .join('')}
      </div>`
      : '';

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1E3A5F; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">New meeting request</h2>
      <p>A recruiter asked to meet with you through your RoleBoost Personal Assistant.</p>
      <p><strong>From:</strong> ${escapeHtml(who)}</p>
      <p><strong>Their availability:</strong></p>
      <p style="white-space: pre-wrap; background: #F5F0E8; padding: 12px; border-radius: 8px;">${escapeHtml(availability)}</p>
      ${transcriptBlock}
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
