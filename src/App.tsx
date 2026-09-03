import { AddLocationAlt, ArrowForward, Close, Public, Timeline } from '@mui/icons-material'
import {
  Autocomplete, Box, Button, Checkbox, Chip, Container, CssBaseline, Dialog, DialogContent, DialogTitle,
  FormControlLabel, Grid, IconButton, Skeleton, Snackbar, Stack, Switch, TextField, ToggleButton,
  ToggleButtonGroup, Toolbar, Tooltip, Typography, createTheme, ThemeProvider,
} from '@mui/material'
import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { GlobeMethods } from 'react-globe.gl'
import Markdown from 'react-markdown'
import { Route, Routes } from 'react-router'
import './style.css'

type Location = {
  id: string; name: string; latitude: number; longitude: number; timezone: string
  startDate: string; endDate: string | null; story: string; photos: string[]; embedPhotos: boolean
}
type User = { email: string }
type Place = { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone: string }
type Arc = { startLat: number; startLng: number; endLat: number; endLng: number }

const Globe = lazy(() => import('react-globe.gl'))
const StoryEditor = lazy(() => import('./StoryEditor'))
const earth = '/earth-blue-marble.jpg'
const bump = '/earth-topology.png'

function placeLabel(place: Place) {
  return [place.name, place.admin1 !== place.name && place.admin1, place.country].filter(Boolean).join(', ')
}

function PlaceSearch({ value, onChange }: { value: Place | null; onChange: (place: Place | null) => void }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (query.trim().length < 3) { setOptions([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`, { signal: controller.signal })
        setOptions((await response.json()).results ?? [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setOptions([])
      } finally { setLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  return <>
    <Autocomplete value={value} options={options} loading={loading} filterOptions={items => items}
      getOptionLabel={placeLabel} isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, selected) => onChange(selected)} onInputChange={(_, text) => setQuery(text)}
      renderInput={params => <TextField {...params} label="Location" placeholder="Search city or place" required helperText="Coordinates and timezone are added automatically" />} />
    {value && <>
      <input type="hidden" name="name" value={value.name} />
      <input type="hidden" name="latitude" value={value.latitude} />
      <input type="hidden" name="longitude" value={value.longitude} />
      <input type="hidden" name="timezone" value={value.timezone} />
    </>}
  </>
}

function WorldGlobe({ locations, compact = false }: { locations: Location[]; compact?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const globe = useRef<GlobeMethods>()
  const [size, setSize] = useState(560)
  const arcs = useMemo<Arc[]>(() => locations.slice(1).map((location, index) => ({
    startLat: locations[index].latitude, startLng: locations[index].longitude,
    endLat: location.latitude, endLng: location.longitude,
  })), [locations])

  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(([entry]) => setSize(Math.round(Math.min(entry.contentRect.width, compact ? 520 : 680))))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [compact])

  function ready() {
    if (!globe.current) return
    globe.current.controls().autoRotate = !locations.length
    globe.current.controls().autoRotateSpeed = .35
    globe.current.controls().enablePan = false
    const latest = locations[0]
    globe.current.pointOfView(latest ? { lat: latest.latitude, lng: latest.longitude, altitude: 1.9 } : { lat: 18, lng: 12, altitude: 2.2 }, 900)
  }

  return <Box ref={host} className={`world-globe ${compact ? 'compact' : ''}`} aria-label="Interactive world globe">
    <Suspense fallback={<Skeleton variant="circular" width={size} height={size} animation="wave" />}>
      <Globe ref={globe} width={size} height={size} backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={earth} bumpImageUrl={bump} showAtmosphere atmosphereColor="#81d8d0" atmosphereAltitude={0.16}
        pointsData={locations} pointLat="latitude" pointLng="longitude" pointColor={() => '#ffcf72'}
        pointAltitude={0.12} pointRadius={0.32} pointLabel={item => (item as Location).name}
        arcsData={arcs} arcStartLat="startLat" arcStartLng="startLng" arcEndLat="endLat" arcEndLng="endLng"
        arcColor={() => ['rgba(255,207,114,.2)', '#ffcf72']} arcDashLength={0.45} arcDashGap={0.18} arcDashAnimateTime={2400}
        showGraticules onGlobeReady={ready} />
    </Suspense>
    <Typography className="globe-hint" variant="caption">Drag to explore · Scroll to zoom</Typography>
  </Box>
}

function Landing({ onLogin }: { onLogin: (user: User) => void }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError('')
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) })
      if (!response.ok) throw new Error((await response.json()).detail ?? 'Could not continue')
      onLogin(await response.json())
    } catch (error) { setError((error as Error).message) } finally { setSubmitting(false) }
  }

  return <main className="landing">
    <header className="brand"><Public /><span>Travel Globe</span></header>
    <section className="landing-copy">
      <Typography className="eyebrow">A living atlas of everywhere you’ve been</Typography>
      <Typography component="h1" aria-label="Every journey has a place">Every journey<br />has a place.</Typography>
      <Typography className="lead">Build a private, visual archive of the cities, stories, photographs, and moments that shaped your world.</Typography>
      <Stack direction="row" className="feature-line"><span>01</span><p>Pin every stay</p><span>02</span><p>Keep the story</p><span>03</span><p>Watch your world grow</p></Stack>
    </section>
    <aside className="landing-globe"><WorldGlobe locations={[]} compact /></aside>
    <Box component="form" onSubmit={login} className="login-form">
      <Typography className="eyebrow">Your private atlas</Typography><Typography component="h2">Step inside</Typography>
      <TextField name="email" type="email" label="Email address" autoComplete="email" required fullWidth />
      <TextField name="password" type="password" label="Password" autoComplete="current-password" slotProps={{ htmlInput: { minLength: 8 } }} required fullWidth />
      <Button type="submit" variant="contained" size="large" endIcon={<ArrowForward />} disabled={submitting}>{submitting ? 'Opening your atlas…' : 'Continue'}</Button>
      <Typography variant="caption">New here? Your private space is created on first sign-in.</Typography>
    </Box>
    <Snackbar open={!!error} message={error} onClose={() => setError('')} autoHideDuration={6000} />
  </main>
}

function Clock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  return <Chip label={now.toLocaleTimeString([], { timeZone: timezone, hour: '2-digit', minute: '2-digit' })} title={timezone} />
}

function LocationStory({ location, current }: { location: Location; current: boolean }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  return <article className="location-story">
    <header><Box><Typography className="eyebrow">{current ? 'Here now' : location.timezone}</Typography><Typography component="h3">{location.name}</Typography></Box>{current && <Clock timezone={location.timezone} />}</header>
    <Typography className="dates">{location.startDate}{location.endDate && ` — ${location.endDate}`}</Typography>
    {location.story && <Box className="story"><Markdown>{location.story}</Markdown></Box>}
    {location.embedPhotos && !!location.photos.length && <button type="button" aria-label={`Open ${location.name} photo gallery`} onClick={() => setGalleryOpen(true)} className={`inline-photos count-${Math.min(location.photos.length, 3)}`}>
      {location.photos.slice(0, location.photos.length >= 3 ? 3 : 2).map((photo, index) => <img key={photo} src={photo} alt={`${location.name} inline photo ${index + 1}`} />)}
    </button>}
    {!!location.photos.length && <Box className="photo-gallery"><Typography className="eyebrow">All photographs · {location.photos.length}</Typography><Box className="gallery-strip">{location.photos.map((photo, index) =>
      <button type="button" key={photo} onClick={() => setGalleryOpen(true)}><img src={photo} alt={`${location.name} gallery photo ${index + 1}`} /></button>
    )}</Box></Box>}
    <Dialog open={galleryOpen} onClose={() => setGalleryOpen(false)} maxWidth="lg" fullWidth aria-labelledby={`gallery-${location.id}`}>
      <DialogTitle id={`gallery-${location.id}`}>{location.name} photo gallery <IconButton aria-label="Close gallery" onClick={() => setGalleryOpen(false)}><Close /></IconButton></DialogTitle>
      <DialogContent className="gallery-dialog">{location.photos.map((photo, index) => <img key={photo} src={photo} alt={`${location.name} full photo ${index + 1}`} />)}</DialogContent>
    </Dialog>
  </article>
}

function isCurrent(location: Location) {
  const today = new Date().toISOString().slice(0, 10)
  return location.startDate <= today && (!location.endDate || location.endDate >= today)
}

function LoadingView() {
  return <section className="atlas-layout" aria-label="Loading travel atlas"><Skeleton className="globe-skeleton" variant="circular" /><Stack className="journey-index">{[1, 2, 3].map(item => <Box key={item} className="journey-skeleton"><Skeleton width="28%" /><Skeleton width="72%" height={42} /><Skeleton width="48%" /></Box>)}</Stack></section>
}

function TravelPage({ user }: { user: User }) {
  const [locations, setLocations] = useState<Location[]>([])
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [view, setView] = useState<'globe' | 'timeline'>('globe')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [story, setStory] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/locations?scope=${scope}`)
      if (!response.ok) throw new Error('Could not load your atlas')
      setLocations(await response.json())
    } catch (error) { setError((error as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [scope])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!place) { setError('Choose a location from the suggestions'); return }
    setSaving(true); setError('')
    const form = event.currentTarget
    try {
      const response = await fetch('/api/locations', { method: 'POST', body: new FormData(form) })
      if (!response.ok) throw new Error((await response.json()).detail ?? 'Could not save location')
      const created: Location = await response.json()
      form.reset(); setPlace(null); setStory(''); setAdding(false); setNotice(`${created.name} was added to your atlas`)
      if (!isCurrent(created) && scope !== 'all') setScope('all'); else await load()
    } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }

  return <main className="app-shell">
    <Toolbar component="header" className="app-header"><Box className="brand"><Public /><span>Travel Globe</span></Box><Box className="header-actions">
      <Tooltip title={user.email}><Typography className="account">{user.email}</Typography></Tooltip>
      <Button startIcon={<AddLocationAlt />} variant="contained" onClick={() => setAdding(value => !value)}>{adding ? 'Close editor' : 'Add location'}</Button>
    </Box></Toolbar>
    {adding && <Box component="section" className="editor-band"><Container maxWidth="lg"><Box component="form" onSubmit={submit} className="location-form">
      <Box className="form-intro"><Typography className="eyebrow">New chapter</Typography><Typography component="h2">Where did life take you?</Typography><Typography>Choose a place, set the dates, then add as much or as little of the story as you want.</Typography></Box>
      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid size={12}><PlaceSearch value={place} onChange={setPlace} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField name="start_date" label="From" type="date" slotProps={{ inputLabel: { shrink: true } }} required fullWidth /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField name="end_date" label="Until (optional)" type="date" slotProps={{ inputLabel: { shrink: true } }} fullWidth /></Grid>
        <Grid size={12}><Suspense fallback={<Skeleton height={220} variant="rounded" />}><StoryEditor onChange={setStory} /></Suspense><input type="hidden" name="story" value={story} /></Grid>
        <Grid size={12}><Stack className="photo-actions" direction={{ xs: 'column', sm: 'row' }}><Button component="label" variant="outlined">Choose photographs<input hidden name="photos" type="file" accept="image/*" multiple /></Button><FormControlLabel control={<Checkbox name="embed_photos" value="true" />} label="Embed photos in story" /><Button className="save-button" type="submit" variant="contained" disabled={saving}>{saving ? 'Saving place…' : 'Save to atlas'}</Button></Stack></Grid>
      </Grid>
    </Box></Container></Box>}
    <Container maxWidth="xl" className="atlas">
      <section className="atlas-heading"><Box><Typography className="eyebrow">Personal world archive</Typography><Typography component="h1">Your world, in motion.</Typography><Typography className="atlas-subtitle">Trace the places that made you—and the stories worth carrying home.</Typography></Box>
        <Stack direction="row" className="view-controls"><FormControlLabel control={<Switch checked={scope === 'all'} onChange={(_, checked) => setScope(checked ? 'all' : 'current')} />} label="Include history" /><ToggleButtonGroup exclusive value={view} onChange={(_, value) => value && setView(value)}><ToggleButton value="globe"><Public /> Globe</ToggleButton><ToggleButton value="timeline"><Timeline /> Timeline</ToggleButton></ToggleButtonGroup></Stack>
      </section>
      {loading ? <LoadingView /> : view === 'globe' ? <section className="atlas-layout">
        <WorldGlobe locations={locations} />
        <aside className="journey-index"><Typography className="eyebrow">{scope === 'all' ? 'Your journey' : 'Current coordinates'}</Typography><Typography component="h2">{locations.length ? `${locations.length} ${locations.length === 1 ? 'place' : 'places'} on view` : 'The world is waiting.'}</Typography>
          {!locations.length ? <Box className="empty-copy"><Typography>{scope === 'current' ? 'No current stay is pinned. Include history to revisit earlier journeys, or add where you are now.' : 'Your first pin turns this globe into a record only you can make.'}</Typography><Button onClick={() => setAdding(true)} endIcon={<ArrowForward />}>Add your first place</Button></Box>
          : <Stack className="place-list">{locations.map((location, index) => <Tooltip key={location.id} title={`${location.startDate}${location.endDate ? ` — ${location.endDate}` : ''}`} placement="left"><button type="button" aria-label={`${location.name} location`} onClick={() => document.querySelector('.world-globe canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><span>{String(index + 1).padStart(2, '0')}</span><strong>{location.name}</strong><small>{location.timezone.replace('_', ' ')}</small></button></Tooltip>)}</Stack>}
        </aside>
      </section> : <section className="timeline-view"><Box className="timeline-intro"><Typography className="eyebrow">Chronology</Typography><Typography component="h2">Places, in the order they found you.</Typography></Box><Box>{locations.length ? locations.map(location => <LocationStory key={location.id} location={location} current={isCurrent(location)} />) : <Box className="empty-copy"><Typography>No journeys match this view.</Typography><Button onClick={() => setAdding(true)}>Add a place</Button></Box>}</Box></section>}
      {view === 'globe' && !!locations.length && <section className="story-band"><Typography className="eyebrow">Field notes</Typography>{locations.map(location => <LocationStory key={location.id} location={location} current={isCurrent(location)} />)}</section>}
    </Container>
    <Snackbar open={!!(error || notice)} message={error || notice} onClose={() => { setError(''); setNotice('') }} autoHideDuration={6000} />
  </main>
}

const theme = createTheme({
  palette: { mode: 'dark', primary: { main: '#f0b95c', contrastText: '#15211f' }, secondary: { main: '#87c8bd' }, background: { default: '#091513', paper: '#10201d' } },
  typography: { fontFamily: '"Avenir Next", "Century Gothic", sans-serif', button: { textTransform: 'none', fontWeight: 700, letterSpacing: '.02em' } }, shape: { borderRadius: 4 },
})

export default function App() {
  const [user, setUser] = useState<User | null>()
  useEffect(() => { fetch('/api/session').then(response => response.ok ? response.json() : null).then(setUser).catch(() => setUser(null)) }, [])
  return <ThemeProvider theme={theme}><CssBaseline /><Routes><Route path="*" element={user ? <TravelPage user={user} /> : <Landing onLogin={setUser} />} /></Routes></ThemeProvider>
}
