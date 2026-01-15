const POLL_MS = 60000;

function formatDate(eventTime) {
  if (!eventTime?.local) return 'Date TBD';
  const date = new Date(eventTime.local);
  if (Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateParts(eventTime) {
  if (!eventTime?.local) return { day: '--', month: '---', year: '----' };
  const date = new Date(eventTime.local);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '---', year: '----' };
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = String(date.getFullYear());
  return { day, month, year };
}

function formatTime(eventTime) {
  if (!eventTime?.local) return 'TBD';
  const date = new Date(eventTime.local);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
}

function formatTimeRange(start, end) {
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  if (startTime === 'TBD' && endTime === 'TBD') return 'Time TBD';
  if (endTime === 'TBD') return startTime;
  return `${startTime} - ${endTime}`;
}

function formatLocation(venue) {
  if (!venue?.address) return 'Location TBD';
  const parts = [
    venue.address.city,
    venue.address.region,
    venue.address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Location TBD';
}

function getDescriptionPreview(event) {
  const raw =
    event.summary ||
    event.description?.text ||
    event.description?.html ||
    '';
  const text = raw.replace(/<[^>]*>/g, '').trim();
  if (!text) {
    return { text: 'No description available.', truncated: false };
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 30) {
    return { text, truncated: false };
  }
  return { text: `${words.slice(0, 30).join(' ')}...`, truncated: true };
}

function formatTicketInfo(event) {
  const capacity = Number.isFinite(event.capacity) ? ` Aú Capacity ${event.capacity}` : '';
  if (event.is_free === true) return `Tickets: Free RSVP${capacity}`;
  if (event.is_free === false) return `Tickets: Paid${capacity}`;
  return `Tickets: Info TBD${capacity}`;
}

function buildTile(event) {
  const date = formatDate(event.start);
  const dateParts = formatDateParts(event.start);
  const timeRange = formatTimeRange(event.start, event.end);
  const location = formatLocation(event.venue);
  const description = getDescriptionPreview(event);
  const ticketInfo = formatTicketInfo(event);
  const name = event.name || 'Untitled Event';
  const url = event.url || '#';
  const detailUrl = `event-single.html?eventId=${encodeURIComponent(event.id)}`;
  const image =
    event.logo?.url ||
    event.logo?.original?.url ||
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=60';
  const host =
    event.organizer?.name ||
    event.organizer_name ||
    event.organization?.name ||
    'Event Organizer';
  return `
          <div class="tile">
            <a class="tile-link" href="${detailUrl}">
              <div class="tile-media">
                <img src="${image}" alt="${name}">
              </div>
            </a>
            <div class="tile-body">
              <div class="tile-date-card" aria-label="${date}">
                <div class="tile-date-day">${dateParts.day}</div>
                <div class="tile-date-month">${dateParts.month}</div>
                <div class="tile-date-year">${dateParts.year}</div>
              </div>
              <div class="tile-content">
                <a class="tile-link" href="${detailUrl}">
                  <h3>${name}</h3>
                </a>
                <div class="tile-meta-row">
                  <span><i class="fa fa-clock-o"></i>${timeRange}</span>
                  <span><i class="fa fa-map-marker"></i>${location}</span>
                </div>
                <p class="tile-description">
                  ${description.text}
                  ${description.truncated ? `<a class="tile-read-more" href="${detailUrl}">Read more..</a>` : ''}
                </p>
                <div class="tile-meta-row">
                  <span><i class="fa fa-ticket"></i>${ticketInfo}</span>
                  <span><i class="fa fa-user"></i>${host}</span>
                </div>
                <div class="tile-actions">
                  <a class="link" href="${detailUrl}">View details</a>
                  <a class="link link-secondary" href="${url}" target="_blank" rel="noopener">RSVP</a>
                </div>
              </div>
            </div>
          </div>
        `;
}

const DISPLAY_LIMIT = 3;
let upcomingVisible = DISPLAY_LIMIT;
let pastVisible = DISPLAY_LIMIT;
let eventsCache = [];
let loadMoreWired = false;

function renderEvents(events) {
  const upcomingContainer = document.getElementById('upcoming-events');
  const pastContainer = document.getElementById('past-events');
  const upcomingLoad = document.getElementById('upcoming-load');
  const pastLoad = document.getElementById('past-load');
  const now = new Date();

  const upcoming = [];
  const past = [];

  events.forEach((event) => {
    const startLocal = event.start?.local;
    const startDate = startLocal ? new Date(startLocal) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      upcoming.push(event);
      return;
    }
    if (startDate >= now) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  });

  if (!upcoming.length) {
    upcomingContainer.innerHTML = '<div class="empty">No upcoming Events</div>';
    upcomingLoad.hidden = true;
  } else {
    const upcomingSlice = upcoming.slice(0, upcomingVisible);
    upcomingContainer.innerHTML = upcomingSlice.map(buildTile).join('');
    upcomingLoad.hidden = upcomingVisible >= upcoming.length;
  }

  if (!past.length) {
    pastContainer.innerHTML = '<div class="empty">No past events yet.</div>';
    pastLoad.hidden = true;
  } else {
    const pastSlice = past.slice(0, pastVisible);
    pastContainer.innerHTML = pastSlice.map(buildTile).join('');
    pastLoad.hidden = pastVisible >= past.length;
  }
}

function wireLoadMore() {
  if (loadMoreWired) return;
  const upcomingLoad = document.getElementById('upcoming-load');
  const pastLoad = document.getElementById('past-load');
  upcomingLoad.addEventListener('click', () => {
    upcomingVisible += DISPLAY_LIMIT;
    renderEvents(eventsCache);
  });
  pastLoad.addEventListener('click', () => {
    pastVisible += DISPLAY_LIMIT;
    renderEvents(eventsCache);
  });
  loadMoreWired = true;
}

async function fetchEvents() {
  try {
    const res = await fetch('/events');
    if (!res.ok) throw new Error('Failed to load events');
    const data = await res.json();
    eventsCache = data.events || [];
    renderEvents(eventsCache);
    wireLoadMore();
  } catch (error) {
    const upcomingContainer = document.getElementById('upcoming-events');
    const pastContainer = document.getElementById('past-events');
    upcomingContainer.innerHTML = '<div class="empty">Error loading events.</div>';
    pastContainer.innerHTML = '';
  }
}

fetchEvents();
setInterval(fetchEvents, POLL_MS);

// Load environment variables from a .env file
require('dotenv').config();
// Import the Axios library for making HTTP requests
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');

function buildAxiosError(context, error) {
    if (error && error.response) {
        const status = error.response.status;
        const data = error.response.data;
        const err = new Error(`${context} failed (status ${status})`);
        err.status = status;
        err.data = data;
        return err;
    }
    if (error && error.request) {
        return new Error(`${context} failed (no response)`);
    }
    return new Error(`${context} failed (${error?.message || 'unknown error'})`);
}

// Function to retrieve a list of organizations associated with the user
async function getOrganizations(){
    try {
        // Making a GET request to the Eventbrite API to fetch organizations
        const organizations = await axios.get(`https://www.eventbriteapi.com/v3/users/me/organizations`, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            }
        });
        return organizations.data; // Returning the response data
    } catch(error) {
        throw buildAxiosError('getOrganizations', error);
    }
}

// Function to retrieve published (live) events for an organization
async function getPublishedEvents(organizationId){
    try {
        const events = await axios.get(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
            params: {
                status: 'live',
                expand: 'logo,venue,organizer',
            },
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });
        return events.data;
    } catch(error) {
        throw buildAxiosError('getPublishedEvents', error);
    }
}

// Function to retrieve a single event with expanded details
async function getEventById(eventId) {
    try {
        const event = await axios.get(`https://www.eventbriteapi.com/v3/events/${eventId}/`, {
            params: {
                expand: 'organizer,venue,logo,category,subcategory',
            },
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });
        return event.data;
    } catch (error) {
        throw buildAxiosError('getEventById', error);
    }
}

// Function to retrieve published events across all organizations
async function getAllPublishedEvents(){
    const organizations = await getOrganizations();
    if (!organizations?.organizations?.length) {
        throw new Error('No organizations returned; check auth token and API response.');
    }
    const allEvents = [];
    for (const org of organizations.organizations) {
        const publishedEvents = await getPublishedEvents(org.id);
        if (publishedEvents?.events?.length) {
            for (const event of publishedEvents.events) {
                allEvents.push({
                    id: event.id,
                    name: event.name?.text,
                    url: event.url,
                    status: event.status,
                    start: event.start,
                    end: event.end,
                    organization_id: event.organization_id,
                    logo: event.logo,
                    description: event.description,
                    summary: event.summary,
                    venue: event.venue,
                    organizer: event.organizer,
                    is_free: event.is_free,
                    capacity: event.capacity,
                });
            }
        }
    }
    return allEvents;
}

// Function to create a new event
async function createEvent(organizationId, eventName, startDate, endDate, currency){
    try {
        // Making a POST request to the Eventbrite API to create an event
        const event = await axios.post(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
            event: {
                name: {
                    html: eventName
                },
                start: {
                    "timezone": "America/Los_Angeles",
                    "utc": startDate
                },
                end: {
                    "timezone": "America/Los_Angeles",
                    "utc": endDate
                },
                currency,
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            },
        });
        return event.data; // Returning the created event data
    } catch(error) {
        console.error('error', error); // Logging any errors encountered
    }
}

// Function to create ticket tiers for an event
async function createTicketsTiers(eventId){
    try {
        // Making a POST request to create a ticket tier
        const ticketsTier = await axios.post(`https://www.eventbriteapi.com/v3/events/${eventId}/inventory_tiers/`, {
            inventory_tier: {
                name: 'VIP',
                count_against_event_capacity: true,
                quantity_total: 30
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            }
        });
        return ticketsTier.data; // Returning the created tickets tier data
    } catch(error) {
        console.error('error', error); // Logging any errors encountered
    }
}

// Function to assign ticket tiers to an event
async function assignTicketTiersToEvent(eventId, ticketTierId){
    try {
        // Making a POST request to assign ticket tiers to an event
        const ticketsAssigned = await axios.post(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
            ticket_class: {
                name: "Vip section",
                free: false,
                donation: false,
                cost: "USD,1000",
                inventory_tier_id: ticketTierId
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            }
        });
        return ticketsAssigned.data; // Returning the assigned ticket tier data
    } catch(error) {
        console.error('error', error); // Logging any errors encountered
    }
}

async function runSetupFlow(){
    const organizations = await getOrganizations(); // Fetching organizations
    if (!organizations?.organizations?.length) {
        throw new Error('No organizations returned; check auth token and API response.');
    }
    const existingEventId = process.env.EVENT_ID;
    let eventId;
    if (existingEventId) {
        eventId = existingEventId;
    } else {
        const eventCreated = await createEvent(
            organizations.organizations[0].id,
            'Coding With Ado MeetUP',
            new Date(new Date().getTime() + 15 * 60000).toISOString().replace(/\.\d{3}/, ''),
            new Date(new Date().getTime() + 30 * 60000).toISOString().replace(/\.\d{3}/, ''),
            'USD'
        );
        console.log(eventCreated);
        eventId = eventCreated.id;
    }
    const ticketTierCreated = await createTicketsTiers(eventId);
    console.log(ticketTierCreated);
    const ticketTierId = ticketTierCreated.inventory_tier_id ?? ticketTierCreated.inventory_tier?.id;
    const ticketsAssigned = await assignTicketTiersToEvent(eventId, ticketTierId);
    console.log(ticketsAssigned); // Logging the result of ticket assignment
}

function startServer(){
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const pathname = url.pathname;

            if (pathname === '/' || pathname === '/index.html') {
                const htmlPath = path.join(__dirname, 'index.html');
                const html = fs.readFileSync(htmlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }
            if (pathname === '/event-single.html') {
                const htmlPath = path.join(__dirname, 'event-single.html');
                const html = fs.readFileSync(htmlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }
            if (pathname === '/events') {
                try {
                    const events = await getAllPublishedEvents();
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ events }));
                } catch (error) {
                    const status = Number.isInteger(error?.status) ? error.status : 502;
                    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        error: error?.message || 'Failed to load events',
                        details: error?.data || null,
                    }));
                }
                return;
            }
            if (pathname === '/event') {
                const eventId = url.searchParams.get('eventId');
                if (!eventId) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Missing eventId' }));
                    return;
                }
                const event = await getEventById(eventId);
                if (!event) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Event not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ event }));
                return;
            }
            if (
                pathname.startsWith('/css/') ||
                pathname.startsWith('/js/') ||
                pathname.startsWith('/images/') ||
                pathname.startsWith('/fonts/')
            ) {
                const filePath = path.resolve(__dirname, `.${pathname}`);
                if (!filePath.startsWith(__dirname)) {
                    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Forbidden');
                    return;
                }
                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Not Found');
                    return;
                }
                const ext = path.extname(filePath).toLowerCase();
                const contentTypes = {
                    '.css': 'text/css; charset=utf-8',
                    '.js': 'application/javascript; charset=utf-8',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.webp': 'image/webp',
                    '.ico': 'image/x-icon',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2',
                    '.ttf': 'font/ttf',
                    '.eot': 'application/vnd.ms-fontobject',
                    '.map': 'application/json; charset=utf-8',
                };
                const contentType = contentTypes[ext] || 'application/octet-stream';
                const file = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(file);
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Server error' }));
        }
    });

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

const mode = process.env.MODE || 'server';
if (mode === 'setup') {
    runSetupFlow().catch((error) => console.error('error', error));
} else {
    startServer();
}
