interface DirectionFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function DirectionField({ value, onChange }: DirectionFieldProps) {
  return (
    <div className="direction-row">
      <label htmlFor="revision-direction">Direction</label>
      <input
        id="revision-direction"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="What should this revision accomplish?"
        autoComplete="off"
      />
    </div>
  );
}
