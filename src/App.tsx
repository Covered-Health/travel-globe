import { AddLocationAlt, Public, Timeline } from '@mui/icons-material'
import {
  Alert, AppBar, Box, Button, Card, CardContent, Chip, Container, CssBaseline,
  FormControlLabel, Grid, IconButton, Paper, Stack, Switch, TextField, ToggleButton,
  ToggleButtonGroup, Toolbar, Typography,
} from '@mui/material'
import { FormEvent, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import './style.css'

type Location = {
  id: string; name: string; latitude: number; longitude: number; timezone: string
  startDate: string; endDate: string | null; note: string; photos: string[]
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
  return <Card className="location-card">
    {location.photos[0] && <img src={location.photos[0]} alt={`${location.name} attachment`} />}
    <CardContent>
      <Stack direction="row" gap={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{location.name}</Typography>
        {current && <Clock timezone={location.timezone} />}
      </Stack>
      <Typography color="text.secondary">{location.startDate}{location.endDate && ` – ${location.endDate}`}</Typography>
      {location.note && <Typography mt={1}>{location.note}</Typography>}
    </CardContent>
  </Card>
}

function isCurrent(location: Location) {
  const today = new Date().toISOString().slice(0, 10)
  return location.startDate <= today && (!location.endDate || location.endDate >= today)
}

function TravelPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [view, setView] = useState<'globe' | 'timeline'>('globe')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = () => fetch(`/api/locations?scope=${scope}`).then(async response => {
    if (!response.ok) throw new Error('Could not load locations')
    setLocations(await response.json())
  }).catch(error => setError(error.message))
  useEffect(() => { void load() }, [scope])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    const response = await fetch('/api/locations', { method: 'POST', body: new FormData(form) })
    if (!response.ok) {
      const body = await response.json()
      setError(body.detail ?? 'Could not save location')
      return
    }
    form.reset()
    setAdding(false)
    await load()
  }

  return <>
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar><Public sx={{ mr: 1 }} /><Typography variant="h5" sx={{ flexGrow: 1 }}>Travel Globe</Typography>
        <Button startIcon={<AddLocationAlt />} variant="contained" onClick={() => setAdding(!adding)}>Add location</Button>
      </Toolbar>
    </AppBar>
    <Container maxWidth="lg">
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {adding && <Paper component="form" onSubmit={submit} className="form">
        <Typography variant="h6">Where have you landed?</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField name="name" label="Location" required fullWidth /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField name="latitude" label="Latitude" type="number" slotProps={{ htmlInput: { step: 'any', min: -90, max: 90 } }} required fullWidth /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField name="longitude" label="Longitude" type="number" slotProps={{ htmlInput: { step: 'any', min: -180, max: 180 } }} required fullWidth /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><TextField name="timezone" label="Timezone" placeholder="Europe/Lisbon" required fullWidth /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><TextField name="start_date" label="From" type="date" slotProps={{ inputLabel: { shrink: true } }} required fullWidth /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><TextField name="end_date" label="Until (optional)" type="date" slotProps={{ inputLabel: { shrink: true } }} fullWidth /></Grid>
          <Grid size={12}><TextField name="note" label="Story or note" multiline rows={3} fullWidth /></Grid>
          <Grid size={12}><Button component="label">Attach photos<input hidden name="photos" type="file" accept="image/*" multiple /></Button></Grid>
        </Grid>
        <Button type="submit" variant="contained">Save location</Button>
      </Paper>}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
        <FormControlLabel control={<Switch checked={scope === 'all'} onChange={(_, checked) => setScope(checked ? 'all' : 'current')} />} label="Include history" />
        <ToggleButtonGroup exclusive value={view} onChange={(_, value) => value && setView(value)}>
          <ToggleButton value="globe"><Public /> Globe</ToggleButton><ToggleButton value="timeline"><Timeline /> Timeline</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {!locations.length ? <Typography sx={{ textAlign: 'center', py: 10 }}>No locations here yet.</Typography> : view === 'globe' ?
        <Box className="globe" aria-label="Travel globe">{locations.map(location =>
          <IconButton key={location.id} aria-label={`${location.name} location`} title={location.name} className="marker" sx={{ left: `${(location.longitude + 180) / 3.6}%`, top: `${(90 - location.latitude) / 1.8}%` }}>●</IconButton>
        )}</Box> : null}
      <Stack className={view === 'timeline' ? 'timeline' : 'cards'}>{locations.map(location => <LocationCard key={location.id} location={location} current={isCurrent(location)} />)}</Stack>
    </Container>
  </>
}

export default function App() {
  return <Routes><Route path="*" element={<TravelPage />} /></Routes>
}
