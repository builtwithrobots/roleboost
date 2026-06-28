import 'server-only';
import { getResend } from './client';
import type { ChatTurn } from '@/lib/types';

const FROM = 'RoleBoost <transcripts@roleboost.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTranscript(messages: ChatTurn[], candidateName: string): string {
  return messages
    .map((m) => {
      const who = m.role === 'user' ? 'Recruiter' : `${candidateName}'s AI`;
      const color = m.role === 'user' ? '#4B6580' : '#1E3A5F';
      return `<p style="margin:0 0 14px;line-height:1.5"><strong style="color:${color}">${esc(who)}</strong><br>${esc(m.content).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function shell(inner: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#1E3A5F;background:#F5F0E8;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D4;border-radius:16px;padding:28px">
      ${inner}
      <hr style="border:none;border-top:1px solid #E8E0D4;margin:20px 0"/>
      <p style="font-size:12px;color:#8FA3B8;margin:0">Powered by RoleBoost AI · honest by design</p>
    </div>
  </div>`;
}

interface DeliverArgs {
  candidateName: string;
  candidateSlug: string;
  candidateEmail: string | null;
  employerEmail: string | null;
  employerCompany: string | null;
  messages: ChatTurn[];
}

/** Sends the post-conversation transcript to the candidate and (if known) the employer. */
export async function sendTranscriptEmails(args: DeliverArgs): Promise<void> {
  const resend = getResend();
  const transcript = renderTranscript(args.messages, args.candidateName);
  const qCount = args.messages.filter((m) => m.role === 'user').length;
  const company = args.employerCompany || 'An anonymous recruiter';
  const heading = `font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1E3A5F;font-size:18px;margin:0 0 8px`;
  const link = `color:#B45309;font-weight:600;text-decoration:none`;

  if (args.candidateEmail) {
    const inner = `
      <h2 style="${heading}">A recruiter just chatted with your RoleBoost AI</h2>
      <p style="margin:0 0 16px;color:#4B6580">${esc(company)} asked your AI ${qCount} question${qCount === 1 ? '' : 's'}.</p>
      ${transcript}
      <p style="margin:16px 0 0"><a href="${APP_URL}/dashboard/ai" style="${link}">Fine-tune your AI →</a></p>`;
    await resend.emails.send({
      from: FROM,
      to: args.candidateEmail,
      subject: 'A recruiter just chatted with your RoleBoost AI',
      html: shell(inner),
    });
  }

  if (args.employerEmail) {
    const inner = `
      <h2 style="${heading}">Your RoleBoost conversation with ${esc(args.candidateName)}</h2>
      <p style="margin:0 0 16px;color:#4B6580">${qCount} question${qCount === 1 ? '' : 's'} asked.</p>
      ${transcript}
      <p style="margin:16px 0 0"><a href="${APP_URL}/c/${esc(args.candidateSlug)}" style="${link}">View ${esc(args.candidateName)}&rsquo;s profile →</a></p>`;
    await resend.emails.send({
      from: FROM,
      to: args.employerEmail,
      subject: `Your RoleBoost conversation with ${args.candidateName}`,
      html: shell(inner),
    });
  }
}
