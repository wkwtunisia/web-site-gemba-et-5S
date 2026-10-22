export default function FilterBar({ zones, value, onChange, onReset }) {
  return (
    <div className="filter-bar">
      <select
        className="filter-control"
        value={value.zone}
        onChange={(e) => onChange({ ...value, zone: e.target.value })}
      >
        <option value="">Toutes les zones</option>
        {zones.map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>

      <input
        type="date"
        className="filter-control"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
      />
      <input
        type="date"
        className="filter-control"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
      />

      <button className="filter-control btn-reset" onClick={onReset}>
        Réinitialiser
      </button>
    </div>
  )
}
