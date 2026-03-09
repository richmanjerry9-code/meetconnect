// components/LocationPicker.jsx
//
// Smart location picker:
//  - Kenya → uses your existing static data (counties, wards, areas dropdowns)
//  - Any other country → uses Google Maps Places API with 3-level autocomplete
//    (Region/State → City/District → Neighbourhood/Area)
//
// Props:
//   kenyaCounties   – the `counties` import from '../data/locations'
//   country         – 'Kenya' | 'Uganda' | 'Tanzania' | ... (string)
//   onCountyChange  – fn(county)
//   onWardChange    – fn(ward)
//   onAreaChange    – fn(area)
//   selectedCounty, selectedWard, selectedArea – controlled values
//   selectClassName – optional CSS class for <select> elements

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGoogleMaps } from '../lib/useGoogleMaps';

// ─── Kenya static picker ────────────────────────────────────────────────────

function KenyaLocationPicker({
  counties,
  selectedCounty,
  selectedWard,
  selectedArea,
  onCountyChange,
  onWardChange,
  onAreaChange,
  selectClassName,
}) {
  const countyOptions = Object.keys(counties);
  const wardOptions =
    selectedCounty && counties[selectedCounty] ? Object.keys(counties[selectedCounty]) : [];
  const areaOptions =
    selectedCounty && selectedWard && counties[selectedCounty]?.[selectedWard]
      ? counties[selectedCounty][selectedWard]
      : [];

  return (
    <>
      <select
        value={selectedCounty}
        onChange={(e) => {
          onCountyChange(e.target.value);
          onWardChange('');
          onAreaChange('');
        }}
        className={selectClassName}
      >
        <option value="">All Counties</option>
        {countyOptions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={selectedWard}
        onChange={(e) => {
          onWardChange(e.target.value);
          onAreaChange('');
        }}
        className={selectClassName}
        disabled={!selectedCounty}
      >
        <option value="">All Wards</option>
        {wardOptions.map((w) => (
          <option key={w} value={w}>{w}</option>
        ))}
      </select>

      <select
        value={selectedArea}
        onChange={(e) => onAreaChange(e.target.value)}
        className={selectClassName}
        disabled={!selectedWard}
      >
        <option value="">All Areas</option>
        {areaOptions.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </>
  );
}

// ─── Google Maps 3-level picker ─────────────────────────────────────────────
//
// Level 1: administrative_area_level_1  (Region / State / Province)
// Level 2: administrative_area_level_2  (District / City / County)
// Level 3: sublocality / neighborhood   (Area / Neighbourhood)

const ADMIN_TYPES_BY_LEVEL = {
  1: ['(regions)'],           // administrative_area_level_1 restricted
  2: ['(cities)'],            // cities / districts
  3: ['establishment', 'geocode'], // neighbourhoods / areas
};

function PlacesAutocomplete({ label, value, onChange, countryCode, locationBias, disabled, inputStyle }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const { ready } = useGoogleMaps();

  useEffect(() => {
    if (!ready || !inputRef.current || disabled) return;

    const options = {
      componentRestrictions: countryCode ? { country: countryCode } : undefined,
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
    };

    if (locationBias?.lat && locationBias?.lng) {
      options.bounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(locationBias.lat - 1, locationBias.lng - 1),
        new window.google.maps.LatLng(locationBias.lat + 1, locationBias.lng + 1)
      );
    }

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, options);
    autocompleteRef.current = ac;

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;

      // Extract the most specific relevant component
      const components = place.address_components;
      const getName = (types) => {
        for (const type of types) {
          const found = components.find((c) => c.types.includes(type));
          if (found) return found.long_name;
        }
        return '';
      };

      onChange({
        name: place.name || place.formatted_address,
        formatted: place.formatted_address,
        adminLevel1: getName(['administrative_area_level_1']),
        adminLevel2: getName(['administrative_area_level_2', 'locality']),
        adminLevel3: getName(['sublocality_level_1', 'neighborhood', 'sublocality']),
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
        raw: place,
      });
    });

    return () => {
      window.google.maps.event.removeListener(listener);
      autocompleteRef.current = null;
    };
  }, [ready, disabled, countryCode, locationBias]);

  return (
    <input
      ref={inputRef}
      placeholder={disabled ? '—' : label}
      defaultValue={value}
      style={inputStyle || {
        padding: '10px 12px',
        border: '1px solid #ddd',
        borderRadius: 8,
        fontSize: '0.95rem',
        width: '100%',
        cursor: disabled ? 'not-allowed' : 'text',
        background: disabled ? '#f5f5f5' : '#fff',
        color: '#000',
      }}
      disabled={disabled}
    />
  );
}

function GoogleLocationPicker({
  country,
  countryCode,
  selectedLevel1,
  selectedLevel2,
  selectedLevel3,
  onLevel1Change,
  onLevel2Change,
  onLevel3Change,
  inputStyle,
}) {
  const { ready, error } = useGoogleMaps();

  // locationBias for level 2/3 based on previous selection coords
  const [level1Coords, setLevel1Coords] = useState(null);
  const [level2Coords, setLevel2Coords] = useState(null);

  const handleLevel1 = useCallback((place) => {
    onLevel1Change(place.adminLevel1 || place.name);
    onLevel2Change('');
    onLevel3Change('');
    if (place.lat && place.lng) setLevel1Coords({ lat: place.lat, lng: place.lng });
  }, [onLevel1Change, onLevel2Change, onLevel3Change]);

  const handleLevel2 = useCallback((place) => {
    onLevel2Change(place.adminLevel2 || place.name);
    onLevel3Change('');
    if (place.lat && place.lng) setLevel2Coords({ lat: place.lat, lng: place.lng });
  }, [onLevel2Change, onLevel3Change]);

  const handleLevel3 = useCallback((place) => {
    onLevel3Change(place.adminLevel3 || place.adminLevel2 || place.name);
  }, [onLevel3Change]);

  if (error) {
    return (
      <p style={{ color: 'red', fontSize: '0.85rem' }}>
        Google Maps unavailable: {error}. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </p>
    );
  }

  if (!ready) {
    return <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Loading Google Maps…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <PlacesAutocomplete
        label={`Region / State (${country})`}
        value={selectedLevel1}
        onChange={handleLevel1}
        countryCode={countryCode}
        inputStyle={inputStyle}
      />
      <PlacesAutocomplete
        label="City / District"
        value={selectedLevel2}
        onChange={handleLevel2}
        countryCode={countryCode}
        locationBias={level1Coords}
        disabled={!selectedLevel1}
        inputStyle={inputStyle}
      />
      <PlacesAutocomplete
        label="Area / Neighbourhood"
        value={selectedLevel3}
        onChange={handleLevel3}
        countryCode={countryCode}
        locationBias={level2Coords}
        disabled={!selectedLevel2}
        inputStyle={inputStyle}
      />
    </div>
  );
}

// ─── ISO-3166 alpha-2 map for common African countries ───────────────────────
const COUNTRY_CODES = {
  Kenya: 'ke',
  Uganda: 'ug',
  Tanzania: 'tz',
  Rwanda: 'rw',
  Ethiopia: 'et',
  Burundi: 'bi',
  'South Sudan': 'ss',
  Somalia: 'so',
  'DR Congo': 'cd',
  Mozambique: 'mz',
  Zambia: 'zm',
  Zimbabwe: 'zw',
  Malawi: 'mw',
  'South Africa': 'za',
  Nigeria: 'ng',
  Ghana: 'gh',
  Senegal: 'sn',
  Cameroon: 'cm',
  Egypt: 'eg',
};

// ─── Main exported component ─────────────────────────────────────────────────

export default function LocationPicker({
  kenyaCounties,
  country = 'Kenya',
  selectedCounty,
  selectedWard,
  selectedArea,
  onCountyChange,
  onWardChange,
  onAreaChange,
  selectClassName,
  inputStyle,
}) {
  const isKenya = country === 'Kenya' || !country;
  const countryCode = COUNTRY_CODES[country] || '';

  if (isKenya) {
    return (
      <KenyaLocationPicker
        counties={kenyaCounties}
        selectedCounty={selectedCounty}
        selectedWard={selectedWard}
        selectedArea={selectedArea}
        onCountyChange={onCountyChange}
        onWardChange={onWardChange}
        onAreaChange={onAreaChange}
        selectClassName={selectClassName}
      />
    );
  }

  return (
    <GoogleLocationPicker
      country={country}
      countryCode={countryCode}
      selectedLevel1={selectedCounty}
      selectedLevel2={selectedWard}
      selectedLevel3={selectedArea}
      onLevel1Change={onCountyChange}
      onLevel2Change={onWardChange}
      onLevel3Change={onAreaChange}
      inputStyle={inputStyle}
    />
  );
}
