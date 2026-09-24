import {
  AddLocationAlt,
  ArrowBack,
  ArrowForward,
  Close,
  Logout,
  Public,
  Timeline,
} from "@mui/icons-material";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import {
  createContext,
  FormEvent,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GlobeMethods } from "react-globe.gl";
import Markdown from "react-markdown";
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router";
import {
  CanvasTexture,
  CatmullRomCurve3,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { globeRoutePoints, journeyLegs, overlayScale } from "./journeys";
import { placeName } from "./places";
import "./style.css";

type Traveler = { id: string; name: string };
type Location = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  startDate: string;
  endDate: string | null;
  story: string;
  photos: string[];
  embedPhotos: boolean;
  traveler: Traveler;
};
type User = { email: string; name: string };
type Place = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};
type Arc = { startLat: number; startLng: number; endLat: number; endLng: number; color: string };
type GlobeRoute = Arc & { scale: number };
type TravelerDetails = Traveler & { locations: Omit<Location, "traveler">[] };

const Globe = lazy(() => import("react-globe.gl"));
const StoryEditor = lazy(() => import("./StoryEditor"));
const SignOutContext = createContext<() => void>(() => {});
const maptilerKey = import.meta.env.VITE_MAPTILER_KEY;
const colors = ["#f0b95c", "#66c7bb", "#ef8275", "#a98de5", "#79a9f2", "#d88eb7", "#9ac76b"];
const exampleLocations: Location[] = [
  {
    id: "example-lisbon",
    name: "Lisbon",
    latitude: 38.72,
    longitude: -9.14,
    timezone: "Europe/Lisbon",
    startDate: "2026-04-03",
    endDate: "2026-04-12",
    story: "",
    photos: [],
    embedPhotos: false,
    traveler: { id: "example-a", name: "Maya Chen" },
  },
  {
    id: "example-kyoto",
    name: "Kyoto",
    latitude: 35.01,
    longitude: 135.77,
    timezone: "Asia/Tokyo",
    startDate: "2026-05-01",
    endDate: "2026-05-09",
    story: "",
    photos: [],
    embedPhotos: false,
    traveler: { id: "example-a", name: "Maya Chen" },
  },
  {
    id: "example-reykjavik",
    name: "Reykjavík",
    latitude: 64.15,
    longitude: -21.94,
    timezone: "Atlantic/Reykjavik",
    startDate: "2026-03-10",
    endDate: "2026-03-16",
    story: "",
    photos: [],
    embedPhotos: false,
    traveler: { id: "example-b", name: "Noah Okafor" },
  },
  {
    id: "example-cape-town",
    name: "Cape Town",
    latitude: -33.92,
    longitude: 18.42,
    timezone: "Africa/Johannesburg",
    startDate: "2026-06-04",
    endDate: "2026-06-18",
    story: "",
    photos: [],
    embedPhotos: false,
    traveler: { id: "example-b", name: "Noah Okafor" },
  },
];

function travelerColor(id: string) {
  return colors[[...id].reduce((total, letter) => total + letter.charCodeAt(0), 0) % colors.length];
}

function PlaceSearch({
  value,
  onChange,
}: {
  value: Place | null;
  onChange: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 3) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`,
          { signal: controller.signal },
        );
        setOptions((await response.json()).results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <>
      <Autocomplete
        value={value}
        options={options}
        loading={loading}
        filterOptions={(items) => items}
        getOptionLabel={placeName}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, selected) => onChange(selected)}
        onInputChange={(_, text) => setQuery(text)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Location"
            placeholder="Search city or place"
            required
            helperText="Coordinates and timezone are added automatically"
          />
        )}
      />
      {value && (
        <>
          <input type="hidden" name="name" value={placeName(value)} />
          <input type="hidden" name="latitude" value={value.latitude} />
          <input type="hidden" name="longitude" value={value.longitude} />
          <input type="hidden" name="timezone" value={value.timezone} />
        </>
      )}
    </>
  );
}

function journeyArcs(locations: Location[]) {
  return journeyLegs(locations).map(({ from, to }): Arc => ({
    startLat: from.latitude,
    startLng: from.longitude,
    endLat: to.latitude,
    endLng: to.longitude,
    color: travelerColor(to.traveler.id),
  }));
}

function routeMesh(arc: GlobeRoute) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 16;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#24403b");
  gradient.addColorStop(1, arc.color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#f5ead0aa";
  context.lineWidth = 1.4;
  for (let x = 42 * arc.scale; x < canvas.width - 5 * arc.scale; x += 52 * arc.scale) {
    context.beginPath();
    context.moveTo(x - 5 * arc.scale, 4);
    context.lineTo(x, 8);
    context.lineTo(x - 5 * arc.scale, 12);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const points = globeRoutePoints(
    { latitude: arc.startLat, longitude: arc.startLng },
    { latitude: arc.endLat, longitude: arc.endLng },
  ).map(({ lat, lng, alt }) => {
    const radius = 100 * (1 + alt);
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((90 - lng) * Math.PI) / 180;
    return new Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  });
  return new Mesh(
    new TubeGeometry(new CatmullRomCurve3(points), 64, 0.32 * arc.scale, 6),
    new MeshBasicMaterial({ map: texture }),
  );
}

function WorldGlobe({
  locations,
  immersive = false,
}: {
  locations: Location[];
  immersive?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState({ width: 560, height: 560 });
  const [scale, setScale] = useState(1);
  const baseAltitude = immersive ? 3.2 : locations.length ? 1.9 : 2.2;
  const arcs = useMemo(() => journeyArcs(locations), [locations]);
  const routes = useMemo(() => arcs.map((arc) => ({ ...arc, scale })), [arcs, scale]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = Math.min(width, 680);
      setDimensions(
        immersive
          ? { width: Math.round(width), height: Math.round(height) }
          : { width: Math.round(size), height: Math.round(size) },
      );
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [immersive]);
  function ready() {
    if (!globe.current) return;
    const controls = globe.current.controls();
    controls.autoRotate = !locations.length;
    controls.autoRotateSpeed = 0.3;
    controls.enablePan = false;
    const latest = locations[0];
    globe.current.pointOfView(
      latest
        ? { lat: latest.latitude, lng: latest.longitude, altitude: baseAltitude }
        : { lat: 18, lng: 12, altitude: baseAltitude },
      900,
    );
  }
  return (
    <Box
      ref={host}
      className={`world-globe ${immersive ? "immersive" : ""}`}
      aria-label="Interactive world globe"
    >
      <Suspense
        fallback={
          <Skeleton
            variant="circular"
            width={dimensions.height}
            height={dimensions.height}
            animation="wave"
          />
        }
      >
        <Globe
          ref={globe}
          width={dimensions.width}
          height={dimensions.height}
          globeOffset={immersive ? [dimensions.width * 0.24, 0] : [0, 0]}
          backgroundColor="rgba(0,0,0,0)"
          bumpImageUrl="/earth-topology.png"
          globeImageUrl={maptilerKey ? undefined : "/earth-blue-marble.jpg"}
          globeTileEngineUrl={
            maptilerKey
              ? (x, y, level) =>
                  `https://api.maptiler.com/maps/hybrid-v4/256/${level}/${x}/${y}.jpg?key=${maptilerKey}`
              : undefined
          }
          showAtmosphere
          atmosphereColor="#81d8d0"
          atmosphereAltitude={0.16}
          labelsData={locations}
          labelLat="latitude"
          labelLng="longitude"
          labelText="name"
          labelColor={(item) => travelerColor((item as Location).traveler.id)}
          labelAltitude={0.001}
          labelSize={(immersive ? 0.65 : 0.75) * scale}
          labelDotRadius={0.3 * scale}
          labelIncludeDot
          labelDotOrientation="bottom"
          labelsTransitionDuration={0}
          onLabelClick={(item) => {
            const location = item as Location;
            if (!location.id.startsWith("example-")) navigate(`/locations/${location.id}`);
          }}
          customLayerData={routes}
          customThreeObject={item => routeMesh(item as GlobeRoute)}
          showGraticules
          onGlobeReady={ready}
          onZoom={({ altitude }) => setScale(overlayScale(baseAltitude, altitude))}
        />
      </Suspense>
      <Typography className="globe-hint" variant="caption">
        Drag to explore · Scroll to zoom
      </Typography>
      {maptilerKey ? (
        <a
          className="map-attribution"
          href="https://www.maptiler.com/copyright/"
          target="_blank"
          rel="noreferrer"
        >
          © MapTiler © OpenStreetMap contributors
        </a>
      ) : (
        <Typography className="map-attribution" variant="caption">
          Add a MapTiler key to show geographic labels
        </Typography>
      )}
    </Box>
  );
}

function Header() {
  const navigate = useNavigate();
  const onSignOut = useContext(SignOutContext);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      navigate("/", { replace: true });
      onSignOut();
    } catch (error) {
      setError((error as Error).message);
      setSigningOut(false);
    }
  }
  return (
    <>
      <Toolbar component="header" className="app-header">
        <Link className="brand" to="/?view=globe&scope=all">
          <Public />
          <span>Travel Globe</span>
        </Link>
        <Stack direction="row" className="header-actions">
          <Button
            component={Link}
            to="/locations/new"
            startIcon={<AddLocationAlt />}
            variant="contained"
          >
            Add location
          </Button>
          <Tooltip title="Sign out">
            <span>
              <Button
                aria-label="Sign out"
                onClick={signOut}
                disabled={signingOut}
                startIcon={signingOut ? <CircularProgress size={18} /> : <Logout />}
              >
                <span className="signout-label">{signingOut ? "Signing out…" : "Sign out"}</span>
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Toolbar>
      <Snackbar
        open={!!error}
        message={error}
        onClose={() => setError("")}
        autoHideDuration={6000}
      />
    </>
  );
}

function Landing({ onLogin }: { onLogin: (user: User) => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          first_name: data.get("first_name"),
          last_name: data.get("last_name"),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Could not continue");
      onLogin(await response.json());
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="landing">
      <header className="brand">
        <Public />
        <span>Travel Globe</span>
      </header>
      <section className="landing-copy">
        <Typography className="eyebrow">A living atlas of everywhere you’ve been</Typography>
        <Typography component="h1" aria-label="Every journey has a place">
          Every journey
          <br />
          has a place.
        </Typography>
        <Typography className="lead">
          Build a visual archive of the cities, stories, photographs, and moments that shaped your
          world.
        </Typography>
        <Stack direction="row" className="feature-line">
          <span>01</span>
          <p>Pin every stay</p>
          <span>02</span>
          <p>Keep the story</p>
          <span>03</span>
          <p>Watch your world grow</p>
        </Stack>
      </section>
      <aside className="landing-globe">
        <WorldGlobe locations={exampleLocations} immersive />
        <Typography className="example-caption">A glimpse of journeys around us</Typography>
      </aside>
      <Box component="form" onSubmit={login} className="login-form">
        <Typography className="eyebrow">Your travel atlas</Typography>
        <Typography component="h2">Step inside</Typography>
        <TextField
          name="first_name"
          label="First name"
          autoComplete="given-name"
          required
          fullWidth
        />
        <TextField
          name="last_name"
          label="Last name"
          autoComplete="family-name"
          required
          fullWidth
        />
        <TextField
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          slotProps={{ htmlInput: { minLength: 8 } }}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          disabled={submitting}
        >
          {submitting ? "Opening your atlas…" : "Continue"}
        </Button>
        <Typography variant="caption">
          New here? Your traveler account is created on first sign-in.
        </Typography>
      </Box>
      <Snackbar
        open={!!error}
        message={error}
        onClose={() => setError("")}
        autoHideDuration={6000}
      />
    </main>
  );
}

function useApi<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError("");
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail ?? "Could not load page");
        return response.json();
      })
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, [url]);
  return { data, error };
}

function LoadingView() {
  return (
    <section className="atlas-layout" aria-label="Loading travel atlas">
      <Skeleton className="globe-skeleton" variant="circular" />
      <Stack className="journey-index">
        {[1, 2, 3].map((item) => (
          <Box key={item} className="journey-skeleton">
            <Skeleton width="28%" />
            <Skeleton width="72%" height={42} />
            <Skeleton width="48%" />
          </Box>
        ))}
      </Stack>
    </section>
  );
}

function AtlasPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "timeline" ? "timeline" : "globe";
  const scope = params.get("scope") === "current" ? "current" : "all";
  const { data: locations, error } = useApi<Location[]>(`/api/atlas?scope=${scope}`);
  const travelers = useMemo(
    () => [
      ...new Map(
        (locations ?? []).map((location) => [location.traveler.id, location.traveler]),
      ).values(),
    ],
    [locations],
  );
  const updateView = (next: "globe" | "timeline") => setParams({ view: next, scope });
  const updateScope = (next: "current" | "all") => setParams({ view, scope: next });
  return (
    <main className="app-shell">
      <Header />
      <Container maxWidth="xl" className="atlas">
        <section className="atlas-heading">
          <Box>
            <Typography className="eyebrow">Shared world archive</Typography>
            <Typography component="h1">
              Where we are.
              <br />
              Where we’ve been.
            </Typography>
            <Typography className="atlas-subtitle">
              Every traveler has a color. Every line is a journey.
            </Typography>
          </Box>
          <Stack direction="row" className="view-controls">
            <FormControlLabel
              control={
                <Switch
                  checked={scope === "all"}
                  onChange={(_, checked) => updateScope(checked ? "all" : "current")}
                />
              }
              label="Include history"
            />
            <ToggleButtonGroup
              exclusive
              value={view}
              onChange={(_, value) => value && updateView(value)}
            >
              <ToggleButton value="globe">
                <Public /> Globe
              </ToggleButton>
              <ToggleButton value="timeline">
                <Timeline /> Timeline
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </section>
        {!locations ? (
          <LoadingView />
        ) : view === "globe" ? (
          <section className="atlas-layout">
            <WorldGlobe locations={locations} />
            <aside className="journey-index">
              <Typography className="eyebrow">Travelers on view</Typography>
              <Typography component="h2">
                {travelers.length
                  ? `${travelers.length} ${travelers.length === 1 ? "story" : "stories"}, one world.`
                  : "The world is waiting."}
              </Typography>
              {travelers.length ? (
                <>
                  <Stack className="traveler-list">
                    {travelers.map((traveler) => (
                      <Link
                        key={traveler.id}
                        aria-label={`${traveler.name} traveler`}
                        to={`/users/${traveler.id}`}
                      >
                        <i style={{ background: travelerColor(traveler.id) }} />
                        <strong>{traveler.name}</strong>
                        <span>
                          {
                            locations.filter((location) => location.traveler.id === traveler.id)
                              .length
                          }{" "}
                          places
                        </span>
                      </Link>
                    ))}
                  </Stack>
                  <nav className="atlas-place-links" aria-label="Places on globe">
                    {locations.map((location) => (
                      <Link
                        key={location.id}
                        aria-label={`${location.name} location`}
                        to={`/locations/${location.id}`}
                      >
                        {location.name}
                        <ArrowForward />
                      </Link>
                    ))}
                  </nav>
                </>
              ) : (
                <EmptyAtlas />
              )}
            </aside>
          </section>
        ) : (
          <section className="timeline-list">
            <Typography className="eyebrow">All arrivals</Typography>
            {locations.length ? (
              locations.map((location) => (
                <article key={location.id}>
                  <span
                    className="traveler-dot"
                    style={{ background: travelerColor(location.traveler.id) }}
                  />
                  <time>{location.startDate}</time>
                  <Link aria-label={`${location.name} location`} to={`/locations/${location.id}`}>
                    {location.name}
                  </Link>
                  <Link
                    aria-label={`${location.traveler.name} traveler`}
                    to={`/users/${location.traveler.id}`}
                  >
                    {location.traveler.name}
                  </Link>
                </article>
              ))
            ) : (
              <EmptyAtlas />
            )}
          </section>
        )}
      </Container>
      <Snackbar open={!!error} message={error} />
    </main>
  );
}

function EmptyAtlas() {
  return (
    <Box className="empty-copy">
      <Typography>
        No places match this view yet. Add a place, or include history to widen the lens.
      </Typography>
      <Button component={Link} to="/locations/new" endIcon={<ArrowForward />}>
        Add a place
      </Button>
    </Box>
  );
}

function NewLocationPage() {
  const navigate = useNavigate();
  const [place, setPlace] = useState<Place | null>(null);
  const [story, setStory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!place) {
      setError("Choose a location from the suggestions");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok)
        throw new Error((await response.json()).detail ?? "Could not save location");
      navigate(`/locations/${(await response.json()).id}`);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="app-shell">
      <Header />
      <Box component="section" className="editor-page">
        <Container maxWidth="lg">
          <Button component={Link} to="/?view=globe&scope=all" startIcon={<ArrowBack />}>
            Back to atlas
          </Button>
          <Box component="form" onSubmit={submit} className="location-form">
            <Box className="form-intro">
              <Typography className="eyebrow">New chapter</Typography>
              <Typography component="h1">Where did life take you?</Typography>
              <Typography>
                Choose a place, set the dates, then add as much or as little of the story as you
                want.
              </Typography>
            </Box>
            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid size={12}>
                <PlaceSearch value={place} onChange={setPlace} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  name="start_date"
                  label="From"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  name="end_date"
                  label="Until (optional)"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Grid>
              <Grid size={12}>
                <Suspense fallback={<Skeleton height={220} variant="rounded" />}>
                  <StoryEditor onChange={setStory} />
                </Suspense>
                <input type="hidden" name="story" value={story} />
              </Grid>
              <Grid size={12}>
                <Stack className="photo-actions" direction={{ xs: "column", sm: "row" }}>
                  <Button component="label" variant="outlined">
                    Choose photographs
                    <input hidden name="photos" type="file" accept="image/*" multiple />
                  </Button>
                  <FormControlLabel
                    control={<Checkbox name="embed_photos" value="true" />}
                    label="Embed photos in story"
                  />
                  <Button
                    className="save-button"
                    type="submit"
                    variant="contained"
                    disabled={saving}
                  >
                    {saving ? "Saving place…" : "Save to atlas"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
      <Snackbar open={!!error} message={error} />
    </main>
  );
}

function Clock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Chip
      label={now.toLocaleTimeString([], { timeZone: timezone, hour: "2-digit", minute: "2-digit" })}
      title={timezone}
    />
  );
}

function isCurrent(location: Location) {
  const today = new Date().toISOString().slice(0, 10);
  return location.startDate <= today && (!location.endDate || location.endDate >= today);
}

function Gallery({ location }: { location: Location }) {
  const [open, setOpen] = useState(false);
  if (!location.photos.length) return null;
  return (
    <>
      <Box className="photo-gallery">
        <Typography className="eyebrow">All photographs · {location.photos.length}</Typography>
        <Box className="gallery-strip">
          {location.photos.map((photo, index) => (
            <button type="button" key={photo} onClick={() => setOpen(true)}>
              <img src={photo} alt={`${location.name} gallery photo ${index + 1}`} />
            </button>
          ))}
        </Box>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        aria-labelledby={`gallery-${location.id}`}
      >
        <DialogTitle id={`gallery-${location.id}`}>
          {location.name} photo gallery{" "}
          <IconButton aria-label="Close gallery" onClick={() => setOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent className="gallery-dialog">
          {location.photos.map((photo, index) => (
            <img key={photo} src={photo} alt={`${location.name} full photo ${index + 1}`} />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LocationPage() {
  const { locationId } = useParams();
  const { data: location, error } = useApi<Location>(`/api/locations/${locationId}`);
  return (
    <main className="app-shell">
      <Header />
      {location ? (
        <Container maxWidth="lg" className="detail-page">
          <Button component={Link} to="/?view=globe&scope=all" startIcon={<ArrowBack />}>
            Back to atlas
          </Button>
          <header className="detail-hero">
            <Box>
              <Typography className="eyebrow">{location.timezone}</Typography>
              <Typography component="h1">{location.name}</Typography>
              <Typography className="dates">
                {location.startDate}
                {location.endDate && ` — ${location.endDate}`}
              </Typography>
            </Box>
            {isCurrent(location) && <Clock timezone={location.timezone} />}
          </header>
          <Link className="byline" to={`/users/${location.traveler.id}`}>
            <i style={{ background: travelerColor(location.traveler.id) }} />
            Journey by {location.traveler.name}
          </Link>
          {location.story && (
            <Box className="story detail-story">
              <Markdown>{location.story}</Markdown>
            </Box>
          )}
          {location.embedPhotos && location.photos.length > 0 && (
            <button
              type="button"
              className={`inline-photos count-${Math.min(location.photos.length, 3)}`}
            >
              {location.photos.slice(0, location.photos.length >= 3 ? 3 : 2).map((photo, index) => (
                <img key={photo} src={photo} alt={`${location.name} inline photo ${index + 1}`} />
              ))}
            </button>
          )}
          <Gallery location={location} />
        </Container>
      ) : (
        <DetailSkeleton />
      )}
      <Snackbar open={!!error} message={error} />
    </main>
  );
}

function UserPage() {
  const { userId } = useParams();
  const { data: traveler, error } = useApi<TravelerDetails>(`/api/users/${userId}`);
  const locations = traveler?.locations.map((location) => ({
    ...location,
    traveler: { id: traveler.id, name: traveler.name },
  }));
  return (
    <main className="app-shell">
      <Header />
      {traveler && locations ? (
        <Container maxWidth="xl" className="detail-page user-page">
          <Button component={Link} to="/?view=globe&scope=all" startIcon={<ArrowBack />}>
            Back to atlas
          </Button>
          <header className="user-hero">
            <Box>
              <Typography className="eyebrow">Traveler archive</Typography>
              <Typography component="h1">{traveler.name}</Typography>
              <Typography>
                {locations.length} {locations.length === 1 ? "place" : "places"} remembered
              </Typography>
            </Box>
            <i className="user-swatch" style={{ background: travelerColor(traveler.id) }} />
          </header>
          <section className="user-layout">
            <WorldGlobe locations={locations} />
            <Stack className="place-list">
              {locations.map((location, index) => (
                <Link
                  key={location.id}
                  aria-label={`${location.name} location`}
                  to={`/locations/${location.id}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{location.name}</strong>
                  <small>{location.startDate}</small>
                </Link>
              ))}
            </Stack>
          </section>
        </Container>
      ) : (
        <DetailSkeleton />
      )}
      <Snackbar open={!!error} message={error} />
    </main>
  );
}

function DetailSkeleton() {
  return (
    <Container maxWidth="lg" className="detail-page">
      <Skeleton width={120} />
      <Skeleton width="70%" height={160} />
      <Skeleton height={420} />
    </Container>
  );
}

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#f0b95c", contrastText: "#15211f" },
    secondary: { main: "#87c8bd" },
    background: { default: "#091513", paper: "#10201d" },
  },
  typography: {
    fontFamily: '"Avenir Next", "Century Gothic", sans-serif',
    button: { textTransform: "none", fontWeight: 700, letterSpacing: ".02em" },
  },
  shape: { borderRadius: 4 },
});

export default function App() {
  const [user, setUser] = useState<User | null>();
  useEffect(() => {
    fetch("/api/session")
      .then((response) => (response.ok ? response.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {user ? (
        <SignOutContext.Provider value={() => setUser(null)}>
          <Routes>
            <Route path="/" element={<AtlasPage />} />
            <Route path="/locations/new" element={<NewLocationPage />} />
            <Route path="/locations/:locationId" element={<LocationPage />} />
            <Route path="/users/:userId" element={<UserPage />} />
            <Route path="*" element={<AtlasPage />} />
          </Routes>
        </SignOutContext.Provider>
      ) : (
        <Landing onLogin={setUser} />
      )}
    </ThemeProvider>
  );
}
