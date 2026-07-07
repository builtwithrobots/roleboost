import 'server-only';
import { getResend } from './client';

const FROM = 'RoleBoost <transcripts@roleboost.app>';

export interface WeeklyDigestEmail {
  candidateName: string;
  candidateEmail: string;
  /** Profile-link views in the last 7 days. */
  views: number;
  /** Conversations recruiters started with the AI in the last 7 days. */
  conversations: number;
  /** Questions recruiters asked the AI in the last 7 days. */
  questions: number;
  /** Absolute URL to the candidate's analytics dashboard. */
  analyticsUrl: string;
  /** Absolute URL to the AI Studio, for the "sharpen your AI" nudge. */
  studioUrl: string;
}

/**
 * A once-weekly re-engagement summary for a candidate who saw real recruiter
 * activity that week: how many people looked, how many talked to their AI, and
 * how many questions it fielded. Only sent to candidates with activity (the
 * cron filters), so it never reads as noise. Best-effort; never throws in a way
 * the caller must handle.
 */
export async function sendWeeklyDigestEmail({
  candidateName,
  candidateEmail,
  views,
  conversations,
  questions,
  analyticsUrl,
  studioUrl,
}: WeeklyDigestEmail): Promise<void> {
  const resend = getResend();
  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName;

  const stat = (n: number, label: string) => `
    <td style="padding: 8px 14px; text-align: center;">
      <div style="font-size: 28px; font-weight: 700; color: #1E3A5F;">${n}</div>
      <div style="font-size: 13px; color: #4B6580;">${escapeHtml(label)}</div>
    </td>`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1E3A5F; line-height: 1.6;">
      <h2 style="margin: 0 0 6px;">Your week on RoleBoost</h2>
      <p style="margin: 0 0 18px;">Hi ${escapeHtml(firstName)}, here's what recruiters did with your profile over the last 7 days.</p>
      <table style="border-collapse: collapse; background: #F5F0E8; border-radius: 10px; margin: 0 0 20px;">
        <tr>
          ${stat(views, views === 1 ? 'profile view' : 'profile views')}
          ${stat(conversations, conversations === 1 ? 'conversation' : 'conversations')}
          ${stat(questions, questions === 1 ? 'question asked' : 'questions asked')}
        </tr>
      </table>
      <p style="margin: 0 0 16px;">
        <a href="${escapeAttr(analyticsUrl)}" style="display: inline-block; background: #1E3A5F; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px;">See the details</a>
      </p>
      <p style="color: #4B6580; font-size: 14px;">Want your AI to answer even better next week? <a href="${escapeAttr(studioUrl)}" style="color: #1E3A5F;">Sharpen it in AI Studio</a>.</p>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: candidateEmail,
    subject: `Your RoleBoost week: ${views} ${views === 1 ? 'view' : 'views'}, ${questions} ${questions === 1 ? 'question' : 'questions'}`,
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
