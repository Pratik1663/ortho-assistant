import { useEffect, useRef, useState } from 'react'

interface CaptureViewProps {
  capture: string
  chartingNotes: string
  approved: boolean
  stale: boolean
  disabled: boolean
  generating: boolean
  onUpdateCapture: (value: string) => void
  onGenerate: () => void
  onUpdateCharting: (value: string) => void
  onApprove: () => void
  onContinue: () => void
}

// Stages 1 and 2 of the clinical pipeline, in one tab.
//
// Stage 1 holds the practitioner's own notes for this visit as raw text.
// Stage 2 turns them into a clean summary, which the practitioner edits and
// approves. Only the approved summary feeds SOAP; the raw notes never travel
// further than the summarise call.
//
// Paste-only for now. Recorded-encounter capture is a separate build.
export default function CaptureView({
  capture,
  chartingNotes,
  approved,
  stale,
  disabled,
  generating,
  onUpdateCapture,
  onGenerate,
  onUpdateCharting,
  onApprove,
  onContinue,
}: CaptureViewProps) {
  // Typing is held in local state and lifted after a pause. Writing on every
  // keystroke meant re-serialising the whole clinic to localStorage on each
  // character, which gets slower the more patients exist.
  const [draft, setDraft] = useState(capture)
  const latest = useRef(draft)
  const pushUp = useRef(onUpdateCapture)
  pushUp.current = onUpdateCapture
  latest.current = draft

  // Follow external changes (switching visit or patient) without clobbering
  // whatever is being typed right now.
  useEffect(() => {
    setDraft(capture)
    latest.current = capture
  }, [capture])

  useEffect(() => {
    if (draft === capture) {
      return
    }
    const timer = window.setTimeout(() => pushUp.current(draft), 500)
    return () => window.clearTimeout(timer)
  }, [draft, capture])

  // Leaving the tab must not drop the last few characters.
  useEffect(
    () => () => {
      pushUp.current(latest.current)
    },
    [],
  )

  // The summary gets the same treatment, on its own timer.
  const [summaryDraft, setSummaryDraft] = useState(chartingNotes)
  const latestSummary = useRef(summaryDraft)
  const pushSummary = useRef(onUpdateCharting)
  pushSummary.current = onUpdateCharting
  latestSummary.current = summaryDraft

  useEffect(() => {
    setSummaryDraft(chartingNotes)
    latestSummary.current = chartingNotes
  }, [chartingNotes])

  useEffect(() => {
    if (summaryDraft === chartingNotes) {
      return
    }
    const timer = window.setTimeout(() => pushSummary.current(summaryDraft), 500)
    return () => window.clearTimeout(timer)
  }, [summaryDraft, chartingNotes])

  useEffect(
    () => () => {
      pushSummary.current(latestSummary.current)
    },
    [],
  )

  const characters = draft.trim().length
  const hasContent = characters > 0
  const hasSummary = summaryDraft.trim().length > 0

  return (
    <section className="workflow-panel capture-view">
      <div className="workflow-title-row">
        <div>
          <p className="workflow-kicker">Clinical documentation</p>
          <h2>Charting</h2>
          <p>
            Paste your notes from this visit, then generate a summary. The
            summary is what the SOAP note is built from, so review it before
            you approve it.
          </p>
        </div>
        {approved && (
          <button className="workflow-primary" onClick={onContinue} type="button">
            Continue to Ask LEOPA →
          </button>
        )}
      </div>

      <label className="capture-field">
        Visit notes
        <textarea
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Paste or type your notes from this visit. Any format — full sentences, shorthand, or a dictated block."
          rows={hasSummary ? 10 : 18}
          value={draft}
        />
      </label>

      <div className="capture-footer">
        <span className="capture-count">
          {hasContent
            ? `${characters.toLocaleString()} character${characters === 1 ? '' : 's'} · saved automatically`
            : 'Nothing captured yet'}
        </span>
        {hasContent && (
          <button
            className={hasSummary ? 'workflow-secondary' : 'workflow-primary'}
            disabled={disabled}
            onClick={onGenerate}
            type="button"
          >
            {generating
              ? 'Generating summary…'
              : hasSummary
                ? 'Regenerate summary'
                : 'Generate summary'}
          </button>
        )}
      </div>

      {hasSummary && (
        <div className="capture-summary">
          {stale && (
            <p className="capture-stale">
              The visit notes have changed since this summary was generated.
              Regenerate it, or edit it directly, before approving.
            </p>
          )}

          <label className="capture-field">
            Charting summary
            <textarea
              disabled={disabled}
              onChange={(event) => setSummaryDraft(event.target.value)}
              rows={16}
              value={summaryDraft}
            />
          </label>

          <div className="capture-footer">
            <span className="capture-count">
              {approved
                ? 'Approved · this is what the SOAP note will be built from'
                : 'Edit anything that is wrong, then approve'}
            </span>
            {approved ? (
              <button
                className="workflow-secondary"
                onClick={onContinue}
                type="button"
              >
                Continue to Ask LEOPA →
              </button>
            ) : (
              <button
                className="workflow-primary"
                disabled={disabled}
                onClick={onApprove}
                type="button"
              >
                Approve summary
              </button>
            )}
          </div>
        </div>
      )}

      <p className="capture-notice">
        Generated from your notes only — nothing is added, and no diagnosis is
        made here. Approving is what releases the summary to the SOAP note;
        editing the visit notes afterwards will withdraw that approval.
      </p>
    </section>
  )
}
