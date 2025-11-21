import styles from '../styles/Home.module.css';

export default function SearchFilters({
  selectedCounty, setSelectedCounty,
  selectedWard, setSelectedWard,
  selectedArea, setSelectedArea,
  Counties
}) {
  const countyOptions = Object.keys(Counties);
  const wardOptions = selectedCounty && Counties[selectedCounty] ? Object.keys(Counties[selectedCounty]) : [];
  const areaOptions = selectedCounty && selectedWard && Counties[selectedCounty][selectedWard] ? Counties[selectedCounty][selectedWard] : [];

  return (
    <div className={styles.filters}>
      <select
        value={selectedCounty}
        onChange={(e) => { setSelectedCounty(e.target.value); setSelectedWard(''); setSelectedArea(''); }}
        className={styles.select} aria-label="Select County"
      >
        <option value="">All Counties</option>
        {countyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <select
        value={selectedWard}
        onChange={(e) => { setSelectedWard(e.target.value); setSelectedArea(''); }}
        className={styles.select} disabled={!selectedCounty} aria-label="Select Ward"
      >
        <option value="">All Wards</option>
        {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>

      <select
        value={selectedArea}
        onChange={(e) => setSelectedArea(e.target.value)}
        className={styles.select} disabled={!selectedWard} aria-label="Select Area"
      >
        <option value="">All Areas</option>
        {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}
