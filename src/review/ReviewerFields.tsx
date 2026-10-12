import type { Reviewer } from "./types";
export function ReviewerFields({ value, onChange }: { value: Reviewer; onChange: (value: Reviewer) => void }) {
  return <fieldset className="reviewer-fields"><legend>Reviewer</legend>
    <label>Reviewer ID<input value={value.id} maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e => onChange({ ...value, id: e.target.value })} /></label>
    <label className="review-check"><input type="checkbox" checked={value.human_attested} onChange={e => onChange({ ...value, human_attested: e.target.checked })} />I am the human making these judgments.</label>
    <label className="review-check"><input type="checkbox" checked={value.independent} onChange={e => onChange({ ...value, independent: e.target.checked })} />I am independent of the case author; for anonymous comparisons, I do not know the conditions.</label>
    <p className="review-note">These are attestations, not authenticated identity. Non-independent ratings can be recorded but cannot establish independent reliability.</p>
  </fieldset>;
}
