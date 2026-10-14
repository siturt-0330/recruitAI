'use client';

import { frequentQuestions, previousInterview } from './analysis';
import { nowIso } from './dates';
import { uid } from './seed';
import { nextQuestionByRules, organizeNotesByRules, reviewInterviewByRules } from './sophon-rules';
import type { AppData, Episode, Interview, InterviewQuestion, SophonReview } from './types';

/** AI に聞き、使えなければルールで作る。どちらで作ったかも返す */
async function ask<T>(task: string, input: unknown): Promise<T | null> {
  try {
    const res = await fetch('/api/sophon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, input }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function reviewInterview(data: AppData, interview: Interview): Promise<SophonReview> {
  const prev = previousInterview(data, interview);
  const company = data.companies.find((c) => c.id === interview.companyId)?.name ?? '';
  const ai = await ask<{ good: string; improve: string; notes: string[] }>('review', {
    company,
    interview: { round: interview.round, rating: interview.rating, questions: interview.questions, reverseQuestions: interview.reverseQuestions },
    previousInterview: prev ? { round: prev.round, questions: prev.questions } : null,
    frequentQuestions: frequentQuestions(data).slice(0, 5),
    episodes: data.episodes.map((e) => ({ title: e.title, strengths: e.strengths, action: e.action })),
  });
  if (ai) return { ...ai, notes: ai.notes.slice(0, 3), createdAt: nowIso(), by: 'ai' };
  return reviewInterviewByRules(data, interview);
}

export async function organizeNotes(raw: string): Promise<{
  questions: InterviewQuestion[];
  reverseQuestions: string;
  improvements: string;
  by: 'ai' | 'rules';
}> {
  const ai = await ask<{ questions: { question: string; answer: string; stuck: boolean }[]; reverseQuestions: string; improvements: string }>(
    'organize',
    { notes: raw },
  );
  if (ai) return { ...ai, questions: ai.questions.map((q) => ({ ...q, id: uid(), episodeId: '' })), by: 'ai' };
  return { ...organizeNotesByRules(raw), by: 'rules' };
}

export async function deepDive(e: Episode): Promise<{ question: string; strengths: string[]; by: 'ai' | 'rules' }> {
  const ai = await ask<{ question: string; strengths: string[] }>('deepdive', {
    title: e.title,
    period: e.period,
    situation: e.situation,
    task: e.task,
    action: e.action,
    result: e.result,
    chat: e.chat.slice(-8),
  });
  if (ai) return { ...ai, by: 'ai' };
  return { ...nextQuestionByRules(e), by: 'rules' };
}
