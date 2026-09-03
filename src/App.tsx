import { AddLocationAlt, Public, Timeline } from '@mui/icons-material'
import {
  Alert, AppBar, Autocomplete, Box, Button, Card, CardContent, Chip, Container, CssBaseline, Dialog, DialogContent, DialogTitle,
  Checkbox, FormControlLabel, Grid, IconButton, Paper, Stack, Switch, TextField, ToggleButton,
  ToggleButtonGroup, Toolbar, Typography, createTheme, ThemeProvider,
} from '@mui/material'
import { FormEvent, lazy, Suspense, useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { Route, Routes } from 'react-router'
import './style.css'

type Location = {
  id: string; name: string; latitude: number; longitude: number; timezone: string
  startDate: string; endDate: string | null; story: string; photos: string[]; embedPhotos: boolean
}

type User = { email: string }
type Place = { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone: string }
const StoryEditor = lazy(() => import('./StoryEditor'))

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
    <Autocomplete
      value={value} options={options} loading={loading} filterOptions={items => items}
      getOptionLabel={placeLabel} isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, place) => onChange(place)} onInputChange={(_, text) => setQuery(text)}
      renderInput={params => <TextField {...params} label="Location" required />}
    />
    {value && <>
      <input type="hidden" name="name" value={value.name} />
      <input type="hidden" name="latitude" value={value.latitude} />
      <input type="hidden" name="longitude" value={value.longitude} />
      <input type="hidden" name="timezone" value={value.timezone} />
    </>}
  </>
}

function Landing({ onLogin }: { onLogin: (user: User) => void }) {
  const [error, setError] = useState('')

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const response = await fetch('/api/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
    })
    if (!response.ok) {
      const body = await response.json()
      setError(body.detail ?? 'Could not continue')
      return
    }
    onLogin(await response.json())
  }

  return <main className="landing">
    <section className="landing-copy">
      <Chip label="Your world, remembered" color="primary" />
      <Typography component="h1" variant="h2">Every journey has a place</Typography>
      <Typography variant="h6" color="text.secondary">Pin where you are, preserve the story, and watch your travels unfold across the globe.</Typography>
      <Paper component="form" onSubmit={login} className="login-form">
        <Typography variant="h6">Continue to your globe</Typography>
        <TextField name="email" type="email" label="Email" autoComplete="email" required fullWidth />
        <TextField name="password" type="password" label="Password" autoComplete="current-password" slotProps={{ htmlInput: { minLength: 8 } }} required fullWidth />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" size="large">Continue</Button>
        <Typography variant="caption" color="text.secondary">New email? We’ll create your private travel space.</Typography>
      </Paper>
    </section>
    <Box className="hero-globe" aria-label="Illustrated world globe"><i /><i /><i /></Box>
  </main>
}

function Clock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <Chip label={`${timezone} · ${now.toLocaleTimeString([], { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}`} />
}

function LocationCard({ location, current }: { location: Location; current: boolean }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  return <Card className="location-card">
    <CardContent>
      <Stack direction="row" gap={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{location.name}</Typography>
        {current && <Clock timezone={location.timezone} />}
      </Stack>
      <Typography color="text.secondary">{location.startDate}{location.endDate && ` – ${location.endDate}`}</Typography>
      {location.story && <Box className="story"><Markdown>{location.story}</Markdown></Box>}
      {location.embedPhotos && !!location.photos.length && <button type="button" aria-label={`Open ${location.name} photo gallery`} onClick={() => setGalleryOpen(true)} className={`inline-photos count-${Math.min(location.photos.length, 3)}`}>
        {location.photos.slice(0, location.photos.length >= 3 ? 3 : 2).map((photo, index) => <img key={photo} src={photo} alt={`${location.name} inline photo ${index + 1}`} />)}
      </button>}
      {!!location.photos.length && <Box className="photo-gallery">
        <Typography variant="subtitle2">Photos</Typography>
        <Box className="gallery-strip">{location.photos.map((photo, index) =>
          <button type="button" key={photo} onClick={() => setGalleryOpen(true)}><img src={photo} alt={`${location.name} gallery photo ${index + 1}`} /></button>
        )}</Box>
      </Box>}
    </CardContent>
    <Dialog open={galleryOpen} onClose={() => setGalleryOpen(false)} maxWidth="md" fullWidth aria-labelledby={`gallery-${location.id}`}>
      <DialogTitle id={`gallery-${location.id}`}>{location.name} photo gallery</DialogTitle>
      <DialogContent className="gallery-dialog">{location.photos.map((photo, index) =>
        <img key={photo} src={photo} alt={`${location.name} full photo ${index + 1}`} />
      )}</DialogContent>
    </Dialog>
  </Card>
}

function isCurrent(location: Location) {
  const today = new Date().toISOString().slice(0, 10)
  return location.startDate <= today && (!location.endDate || location.endDate >= today)
}

function TravelPage({ user }: { user: User }) {
  const [locations, setLocations] = useState<Location[]>([])
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [view, setView] = useState<'globe' | 'timeline'>('globe')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [story, setStory] = useState('')

  const load = () => fetch(`/api/locations?scope=${scope}`).then(async response => {
    if (!response.ok) throw new Error('Could not load locations')
    setLocations(await response.json())
  }).catch(error => setError(error.message))
  useEffect(() => { void load() }, [scope])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!place) { setError('Choose a location from the suggestions'); return }
    setError('')
    const response = await fetch('/api/locations', { method: 'POST', body: new FormData(form) })
    if (!response.ok) {
      const body = await response.json()
      setError(body.detail ?? 'Could not save location')
      return
    }
    const created = await response.json()
    form.reset()
    setPlace(null)
    setStory('')
    setAdding(false)
    if (isCurrent(created)) await load()
    else setScope('all')
  }

  return <>
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar><Public sx={{ mr: 1 }} /><Typography variant="h5" sx={{ flexGrow: 1 }}>Travel Globe</Typography>
        <Typography color="text.secondary" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user.email}</Typography>
        <Button startIcon={<AddLocationAlt />} variant="contained" onClick={() => setAdding(!adding)}>Add location</Button>
      </Toolbar>
    </AppBar>
    <Container maxWidth="lg">
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {adding && <Paper component="form" onSubmit={submit} className="form">
        <Typography variant="h6">Where have you landed?</Typography>
        <Grid container spacing={2}>
          <Grid size={12}><PlaceSearch value={place} onChange={setPlace} /><Typography variant="caption" color="text.secondary">Place search by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></Typography></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><TextField name="start_date" label="From" type="date" slotProps={{ inputLabel: { shrink: true } }} required fullWidth /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><TextField name="end_date" label="Until (optional)" type="date" slotProps={{ inputLabel: { shrink: true } }} fullWidth /></Grid>
          <Grid size={12}><Suspense fallback={<Typography>Loading editor…</Typography>}><StoryEditor onChange={setStory} /></Suspense><input type="hidden" name="story" value={story} /></Grid>
          <Grid size={12}><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' } }}>
            <Button component="label">Attach photos<input hidden name="photos" type="file" accept="image/*" multiple /></Button>
            <FormControlLabel control={<Checkbox name="embed_photos" value="true" />} label="Embed photos in story" />
          </Stack></Grid>
        </Grid>
        <Button type="submit" variant="contained">Save location</Button>
      </Paper>}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
        <FormControlLabel control={<Switch checked={scope === 'all'} onChange={(_, checked) => setScope(checked ? 'all' : 'current')} />} label="Include history" />
        <ToggleButtonGroup exclusive value={view} onChange={(_, value) => value && setView(value)}>
          <ToggleButton value="globe"><Public /> Globe</ToggleButton><ToggleButton value="timeline"><Timeline /> Timeline</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {!locations.length ? <Paper className="empty-journey">
        <Box className="mini-globe">✦</Box>
        <Typography variant="h4">Start your map</Typography>
        <Typography color="text.secondary">Add the place you are now or begin with a favorite trip.</Typography>
        <Button variant="contained" onClick={() => setAdding(true)}>Pin your first place</Button>
      </Paper> : view === 'globe' ?
        <Box className="globe" aria-label="Travel globe">{locations.map(location =>
          <IconButton key={location.id} aria-label={`${location.name} location`} title={location.name} className="marker" sx={{ left: `${(location.longitude + 180) / 3.6}%`, top: `${(90 - location.latitude) / 1.8}%` }}>●</IconButton>
        )}</Box> : null}
      <Stack className={view === 'timeline' ? 'timeline' : 'cards'}>{locations.map(location => <LocationCard key={location.id} location={location} current={isCurrent(location)} />)}</Stack>
    </Container>
  </>
}

export default function App() {
  const [user, setUser] = useState<User | null>()
  useEffect(() => {
    fetch('/api/session').then(response => response.ok ? response.json() : null).then(setUser).catch(() => setUser(null))
  }, [])
  return <ThemeProvider theme={createTheme({ palette: { mode: 'dark', primary: { main: '#58c7c7' }, secondary: { main: '#ffcc66' } } })}><CssBaseline /><Routes><Route path="*" element={user ? <TravelPage user={user} /> : <Landing onLogin={setUser} />} /></Routes></ThemeProvider>
}
