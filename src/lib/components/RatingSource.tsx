import { useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

export type RatingSource = 'live' | 'tp';

const KEY = 'cgrates_ui_rating_source';

function load(): RatingSource {
  try {
    return localStorage.getItem(KEY) === 'tp' ? 'tp' : 'live';
  } catch {
    return 'live';
  }
}

/** Live vs draft for the Rating pages, remembered per viewer. */
export function useRatingSource(): [RatingSource, (s: RatingSource) => void] {
  const [source, setSource] = useState<RatingSource>(load);
  const set = (s: RatingSource) => {
    setSource(s);
    try { localStorage.setItem(KEY, s); } catch { /* storage blocked: keep it for this visit only */ }
  };
  return [source, set];
}

export const SOURCE_LABEL: Record<RatingSource, string> = { live: 'Live (DataDB)', tp: 'Draft tariff plan (StorDB)' };

export default function RatingSourceToggle({ value, onChange }: { value: RatingSource; onChange: (s: RatingSource) => void }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, v) => v && onChange(v)}>
      <ToggleButton value="live" title="DataDB: what the engine rates with right now">Live (charging now)</ToggleButton>
      <ToggleButton value="tp" title="StorDB tariff plans: not used for charging until loaded into DataDB">Draft tariff plans</ToggleButton>
    </ToggleButtonGroup>
  );
}
