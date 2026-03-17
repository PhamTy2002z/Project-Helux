"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, RefreshCcw, Sparkles } from "lucide-react";

import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePageActive } from "@/hooks/usePageActive";
import { cn } from "@/lib/utils";

import {
  answerOnboardingApiV1BoardsBoardIdOnboardingAnswerPost,
  confirmOnboardingApiV1BoardsBoardIdOnboardingConfirmPost,
  getOnboardingApiV1BoardsBoardIdOnboardingGet,
  startOnboardingApiV1BoardsBoardIdOnboardingStartPost,
} from "@/api/generated/board-onboarding/board-onboarding";
import type {
  BoardOnboardingAgentComplete,
  BoardOnboardingRead,
  BoardOnboardingReadMessages,
  BoardRead,
} from "@/api/generated/model";

type NormalizedMessage = {
  role: string;
  content: string;
};

/**
 * Normalize backend onboarding messages into a strict `{role, content}` list.
 *
 * The server stores messages as untyped JSON; this protects the UI from partial
 * or malformed entries.
 */
const normalizeMessages = (
  value?: BoardOnboardingReadMessages,
): NormalizedMessage[] | null => {
  if (!value) return null;
  if (!Array.isArray(value)) return null;
  const items: NormalizedMessage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const role = typeof raw.role === "string" ? raw.role : null;
    const content = typeof raw.content === "string" ? raw.content : null;
    if (!role || !content) continue;
    items.push({ role, content });
  }
  return items.length ? items : null;
};

type QuestionOption = { id: string; label: string };

type Question = {
  question: string;
  options: QuestionOption[];
};

const FREE_TEXT_OPTION_RE =
  /(i'?ll type|i will type|type it|type my|other|custom|free\\s*text)/i;

const isFreeTextOption = (label: string) => FREE_TEXT_OPTION_RE.test(label);

const normalizeQuestionFragment = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const questionFingerprint = (question: Question | null): string | null => {
  if (!question) return null;
  const normalizedQuestion = normalizeQuestionFragment(question.question);
  const normalizedOptions = question.options
    .map((option) => normalizeQuestionFragment(option.label))
    .sort()
    .join("|");
  return `${normalizedQuestion}::${normalizedOptions}`;
};

/**
 * Best-effort parser for assistant-produced question payloads.
 *
 * During onboarding, the assistant can respond with either:
 * - raw JSON (ideal)
 * - a fenced ```json block
 * - slightly-structured objects
 *
 * This function validates shape and normalizes option ids/labels.
 */
const normalizeQuestion = (value: unknown): Question | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as { question?: unknown; options?: unknown };
  if (typeof data.question !== "string" || !Array.isArray(data.options))
    return null;
  const options: QuestionOption[] = data.options
    .map((option, index) => {
      if (typeof option === "string") {
        return { id: String(index + 1), label: option };
      }
      if (option && typeof option === "object") {
        const raw = option as { id?: unknown; label?: unknown };
        const label =
          typeof raw.label === "string"
            ? raw.label
            : typeof raw.id === "string"
              ? raw.id
              : null;
        if (!label) return null;
        return {
          id: typeof raw.id === "string" ? raw.id : String(index + 1),
          label,
        };
      }
      return null;
    })
    .filter((option): option is QuestionOption => Boolean(option));
  if (!options.length) return null;
  return { question: data.question, options };
};

/**
 * Extract the most recent assistant question from the transcript.
 *
 * We intentionally only inspect the last assistant message: the user may have
 * typed arbitrary text between questions.
 */
const parseQuestion = (messages?: NormalizedMessage[] | null) => {
  if (!messages?.length) return null;
  const lastAssistant = [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant");
  if (!lastAssistant?.content) return null;
  try {
    return normalizeQuestion(JSON.parse(lastAssistant.content));
  } catch {
    const match = lastAssistant.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return normalizeQuestion(JSON.parse(match[1]));
      } catch {
        return null;
      }
    }
  }
  return null;
};

function WaitingStateCard({
  title,
  submittedAnswer,
}: {
  title: string;
  submittedAnswer: string | null;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm text-[color:var(--text)] shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <RefreshCcw className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-strong">{title}</p>
          {submittedAnswer ? (
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">
              Sent:{" "}
              <span className="font-medium text-strong">
                {submittedAnswer}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted">
            This usually takes a few seconds.
          </p>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-strong)]/80">
            <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[color:var(--accent)] animate-progress-shimmer motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BoardOnboardingChat({
  boardId,
  onConfirmed,
}: {
  boardId: string;
  onConfirmed: (board: BoardRead) => void;
}) {
  const isPageActive = usePageActive();
  const [session, setSession] = useState<BoardOnboardingRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingAssistantFingerprint, setAwaitingAssistantFingerprint] =
    useState<string | null>(null);
  const [awaitingKind, setAwaitingKind] = useState<
    "answer" | "extra_context" | null
  >(null);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<string | null>(
    null,
  );
  const [otherText, setOtherText] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [extraContextOpen, setExtraContextOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [lastAnsweredQuestionFingerprint, setLastAnsweredQuestionFingerprint] =
    useState<string | null>(null);
  const freeTextRef = useRef<HTMLTextAreaElement | null>(null);
  const extraContextRef = useRef<HTMLTextAreaElement | null>(null);

  const normalizedMessages = useMemo(
    () => normalizeMessages(session?.messages),
    [session?.messages],
  );
  const lastAssistantFingerprint = useMemo(() => {
    const rawMessages = session?.messages;
    if (!rawMessages || !Array.isArray(rawMessages)) return "";
    for (let idx = rawMessages.length - 1; idx >= 0; idx -= 1) {
      const entry = rawMessages[idx];
      if (!entry || typeof entry !== "object") continue;
      const raw = entry as Record<string, unknown>;
      if (raw.role !== "assistant") continue;
      const content = typeof raw.content === "string" ? raw.content : "";
      const timestamp = typeof raw.timestamp === "string" ? raw.timestamp : "";
      return `${timestamp}|${content}`;
    }
    return "";
  }, [session?.messages]);
  const question = useMemo(
    () => parseQuestion(normalizedMessages),
    [normalizedMessages],
  );
  const currentQuestionFingerprint = useMemo(
    () => questionFingerprint(question),
    [question],
  );
  const draft: BoardOnboardingAgentComplete | null =
    session?.draft_goal ?? null;

  const isAwaitingAgent = useMemo(() => {
    if (!awaitingAssistantFingerprint) return false;
    return lastAssistantFingerprint === awaitingAssistantFingerprint;
  }, [awaitingAssistantFingerprint, lastAssistantFingerprint]);

  const wantsFreeText = useMemo(
    () => selectedOptions.some((label) => isFreeTextOption(label)),
    [selectedOptions],
  );
  const isDuplicateQuestionAfterAnswer = useMemo(() => {
    if (!currentQuestionFingerprint || !lastAnsweredQuestionFingerprint)
      return false;
    if (currentQuestionFingerprint !== lastAnsweredQuestionFingerprint)
      return false;
    if (!lastSubmittedAnswer) return false;
    return !draft;
  }, [
    currentQuestionFingerprint,
    draft,
    lastAnsweredQuestionFingerprint,
    lastSubmittedAnswer,
  ]);

  useEffect(() => {
    if (!wantsFreeText) return;
    freeTextRef.current?.focus();
  }, [wantsFreeText]);

  useEffect(() => {
    if (!extraContextOpen) return;
    extraContextRef.current?.focus();
  }, [extraContextOpen]);

  useEffect(() => {
    setSelectedOptions([]);
    setOtherText("");
  }, [question?.question]);

  useEffect(() => {
    if (!wantsFreeText) setOtherText("");
  }, [wantsFreeText]);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await startOnboardingApiV1BoardsBoardIdOnboardingStartPost(
        boardId,
        {},
      );
      if (result.status !== 200) throw new Error("Unable to start onboarding.");
      setSession(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start onboarding.",
      );
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const refreshSession = useCallback(async () => {
    try {
      const result =
        await getOnboardingApiV1BoardsBoardIdOnboardingGet(boardId);
      if (result.status !== 200) return;
      setSession(result.data);
    } catch {
      // ignore
    }
  }, [boardId]);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  const shouldPollSession =
    isPageActive &&
    (loading ||
      isAwaitingAgent ||
      isDuplicateQuestionAfterAnswer ||
      (!question && !draft));

  useEffect(() => {
    if (!shouldPollSession) return;
    void refreshSession();
    const interval = setInterval(() => {
      void refreshSession();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshSession, shouldPollSession]);

  const handleAnswer = useCallback(
    async (value: string, freeText?: string) => {
      const fingerprintBefore = lastAssistantFingerprint;
      setLoading(true);
      setError(null);
      setAwaitingAssistantFingerprint(null);
      setAwaitingKind(null);
      setLastSubmittedAnswer(null);
      try {
        const result =
          await answerOnboardingApiV1BoardsBoardIdOnboardingAnswerPost(
            boardId,
            {
              answer: value,
              other_text: freeText ?? null,
            },
          );
        if (result.status !== 200) throw new Error("Unable to submit answer.");
        setSession(result.data);
        setOtherText("");
        setSelectedOptions([]);
        setAwaitingAssistantFingerprint(fingerprintBefore);
        setAwaitingKind("answer");
        setLastSubmittedAnswer(freeText ? `${value}: ${freeText}` : value);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit answer.",
        );
      } finally {
        setLoading(false);
      }
    },
    [boardId, lastAssistantFingerprint],
  );

  const toggleOption = useCallback((label: string) => {
    setSelectedOptions((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  }, []);

  const submitExtraContext = useCallback(async () => {
    const trimmed = extraContext.trim();
    if (!trimmed) return;
    const fingerprintBefore = lastAssistantFingerprint;
    setLoading(true);
    setError(null);
    setAwaitingAssistantFingerprint(null);
    setAwaitingKind(null);
    setLastSubmittedAnswer(null);
    try {
      const result =
        await answerOnboardingApiV1BoardsBoardIdOnboardingAnswerPost(boardId, {
          answer: "Additional context",
          other_text: trimmed,
        });
      if (result.status !== 200)
        throw new Error("Unable to submit extra context.");
      setSession(result.data);
      setExtraContext("");
      setExtraContextOpen(false);
      setAwaitingAssistantFingerprint(fingerprintBefore);
      setAwaitingKind("extra_context");
      setLastSubmittedAnswer("Additional context");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit extra context.",
      );
    } finally {
      setLoading(false);
    }
  }, [boardId, extraContext, lastAssistantFingerprint]);

  const submitAnswer = useCallback(() => {
    const trimmedOther = otherText.trim();
    if (selectedOptions.length === 0) return;
    if (wantsFreeText && !trimmedOther) return;
    if (currentQuestionFingerprint) {
      setLastAnsweredQuestionFingerprint(currentQuestionFingerprint);
    }
    const answer = selectedOptions.join(", ");
    void handleAnswer(answer, wantsFreeText ? trimmedOther : undefined);
  }, [
    currentQuestionFingerprint,
    handleAnswer,
    otherText,
    selectedOptions,
    wantsFreeText,
  ]);

  useEffect(() => {
    if (!awaitingAssistantFingerprint) return;
    if (lastAssistantFingerprint !== awaitingAssistantFingerprint) {
      setAwaitingAssistantFingerprint(null);
      setAwaitingKind(null);
      setLastSubmittedAnswer(null);
    }
  }, [awaitingAssistantFingerprint, lastAssistantFingerprint]);

  useEffect(() => {
    if (!isDuplicateQuestionAfterAnswer) return;
    setAwaitingAssistantFingerprint(lastAssistantFingerprint);
    setAwaitingKind("answer");
  }, [isDuplicateQuestionAfterAnswer, lastAssistantFingerprint]);

  const confirmGoal = async () => {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      const result =
        await confirmOnboardingApiV1BoardsBoardIdOnboardingConfirmPost(
          boardId,
          {
            board_type: draft.board_type ?? "goal",
            objective: draft.objective ?? null,
            success_metrics: draft.success_metrics ?? null,
            target_date: draft.target_date ?? null,
          },
        );
      if (result.status !== 200)
        throw new Error("Unable to confirm board goal.");
      onConfirmed(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to confirm board goal.",
      );
    } finally {
      setLoading(false);
    }
  };

  const headerHint = draft
    ? "Review and confirm the generated goal before continuing."
    : "Answer a few quick prompts so the lead agent can draft your goal.";
  const phaseLabel = draft
    ? "Final review"
    : question
      ? "Question in progress"
      : "Initializing";

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-lush">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/50 via-transparent to-blue-100/30" />
      <div className="relative space-y-4 p-4 sm:p-6">
        <DialogHeader className="space-y-2.5 border-b border-[color:var(--border)] pb-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-3 py-1 text-xs font-medium text-[color:var(--text-muted)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-sky-700" />
            {phaseLabel}
          </div>
          <DialogTitle className="font-[var(--font-heading)] text-3xl leading-tight text-strong sm:text-[2.1rem]">
            Board onboarding
          </DialogTitle>
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
            {headerHint}
          </p>
        </DialogHeader>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {draft ? (
          <div className="space-y-4">
            {isAwaitingAgent ? (
              <WaitingStateCard
                title={
                  awaitingKind === "extra_context"
                    ? "Updating the draft..."
                    : "Waiting for the agent..."
                }
                submittedAnswer={lastSubmittedAnswer}
              />
            ) : null}
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-4 text-sm backdrop-blur-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Objective
                  </p>
                  <p className="text-sm text-strong">{draft.objective || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Target date
                  </p>
                  <p className="text-sm text-strong">{draft.target_date || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Board type
                  </p>
                  <p className="text-sm capitalize text-strong">
                    {draft.board_type || "goal"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Success metrics
                  </p>
                  <pre className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
                    {JSON.stringify(draft.success_metrics ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
              {draft.user_profile ? (
                <div className="mt-4 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    User profile
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">
                      Preferred name:
                    </span>{" "}
                    {draft.user_profile.preferred_name || "—"}
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">Pronouns:</span>{" "}
                    {draft.user_profile.pronouns || "—"}
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">Timezone:</span>{" "}
                    {draft.user_profile.timezone || "—"}
                  </p>
                </div>
              ) : null}
              {draft.lead_agent ? (
                <div className="mt-4 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Lead agent preferences
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">Name:</span>{" "}
                    {draft.lead_agent.name || "—"}
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">Role:</span>{" "}
                    {draft.lead_agent.identity_profile?.role || "—"}
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">
                      Communication:
                    </span>{" "}
                    {draft.lead_agent.identity_profile?.communication_style ||
                      "—"}
                  </p>
                  <p className="text-[color:var(--text)]">
                    <span className="font-medium text-strong">Emoji:</span>{" "}
                    {draft.lead_agent.identity_profile?.emoji || "—"}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-strong">
                  Extra context (optional)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setExtraContextOpen((prev) => !prev)}
                  disabled={loading || isAwaitingAgent}
                >
                  {extraContextOpen ? "Hide" : "Add"}
                </Button>
              </div>
              {extraContextOpen ? (
                <div className="mt-3 space-y-3">
                  <Textarea
                    ref={extraContextRef}
                    className="min-h-[88px]"
                    placeholder="Anything else the agent should know before you confirm? (constraints, context, preferences, links, etc.)"
                    value={extraContext}
                    onChange={(event) => setExtraContext(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      if (event.nativeEvent.isComposing) return;
                      if (event.shiftKey) return;
                      event.preventDefault();
                      if (loading || isAwaitingAgent) return;
                      void submitExtraContext();
                    }}
                    disabled={loading || isAwaitingAgent}
                  />
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => void submitExtraContext()}
                      disabled={
                        loading || isAwaitingAgent || !extraContext.trim()
                      }
                    >
                      {loading
                        ? "Sending..."
                        : isAwaitingAgent
                          ? "Waiting..."
                          : "Send context"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    Tip: press Enter to send. Shift+Enter for a newline.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  Add anything that wasn&apos;t covered in the agent&apos;s
                  questions.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                className="min-w-28"
                onClick={confirmGoal}
                disabled={loading || isAwaitingAgent}
                type="button"
              >
                Confirm goal
              </Button>
            </DialogFooter>
          </div>
        ) : question && (isAwaitingAgent || isDuplicateQuestionAfterAnswer) ? (
          <WaitingStateCard
            title="Waiting for the next question..."
            submittedAnswer={lastSubmittedAnswer}
          />
        ) : question ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 backdrop-blur-sm">
              <p className="text-base font-semibold text-strong">
                {question.question}
              </p>
              <p className="mt-1 text-xs text-muted">
                Select one or more options.
              </p>
            </div>
            <div className="space-y-2.5">
              {question.options.map((option) => {
                const isSelected = selectedOptions.includes(option.label);
                return (
                  <button
                    key={option.id}
                    className={cn(
                      "flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
                      isSelected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-strong hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)]",
                      loading && "cursor-not-allowed opacity-70",
                    )}
                    onClick={() => toggleOption(option.label)}
                    disabled={loading}
                    type="button"
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-quiet" />
                    )}
                  </button>
                );
              })}
            </div>
            {wantsFreeText ? (
              <div className="space-y-2">
                <Textarea
                  ref={freeTextRef}
                  className="min-h-[88px]"
                  placeholder="Type your answer..."
                  value={otherText}
                  onChange={(event) => setOtherText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    if (event.nativeEvent.isComposing) return;
                    if (event.shiftKey) return;
                    event.preventDefault();
                    if (loading) return;
                    submitAnswer();
                  }}
                  disabled={loading}
                />
                <p className="text-xs text-muted">
                  Tip: press Enter to send. Shift+Enter for a newline.
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {loading ? "Sending your answer..." : "Press Next to continue."}
              </p>
              <Button
                variant="outline"
                onClick={submitAnswer}
                type="button"
                disabled={
                  loading ||
                  selectedOptions.length === 0 ||
                  (wantsFreeText && !otherText.trim())
                }
              >
                {loading ? "Sending..." : "Next"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--text-muted)] backdrop-blur-sm">
            {loading
              ? "Waiting for the lead agent..."
              : "Preparing onboarding..."}
          </div>
        )}
      </div>
    </div>
  );
}
